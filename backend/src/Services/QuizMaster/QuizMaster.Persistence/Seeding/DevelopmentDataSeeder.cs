using Microsoft.Extensions.DependencyInjection;

namespace QuizMaster.Persistence.Seeding;

// DEVELOPMENT ONLY, OPT-IN (SeedOptions:DemoSchool): a demo organization with one account per role, plus a platform
// administrator for the dev token tool, so every endpoint can be tried locally. The smoke suite runs against it. An
// ordinary start seeds none of this — only the first-run platform administrator (QuizMaster.API/FirstRunSeed).
// The account uids ("dev-admin", "dev-teacher", ...) are what tools/QuizMasterPro.DevToken puts in a token's "sub".
// Runs outside any request, so there is no caller tenant: every row names its tenant explicitly.
public static class DevelopmentDataSeeder
{
    public const string DemoTenantSlug = "demo-school";

    public static async Task SeedDevelopmentDataAsync(this IServiceProvider services, CancellationToken ct = default)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<QuizMasterDbContext>();

        await SeedPlatformAdministratorAsync(db, ct);

        if (await db.Tenants.AnyAsync(tenant => tenant.Slug == DemoTenantSlug, ct))
            return;

        var now = DateTime.UtcNow;
        var system = new SystemAction(QuizMasterActionType.Seed, now);

        var tenant = Tenant.Create(DemoTenantSlug, "Demo School", TenantPlan.Trial, system);
        db.Tenants.Add(tenant);
        await db.SaveChangesAsync(ct);

        T InTenant<T>(T entity) where T : IMultitenancy
        {
            entity.TenantId = tenant.Id;
            return entity;
        }

        // ---- people ----
        var admin = InTenant(User.Create(tenant.Id, "dev-admin", "admin@demo-school.local", "Amira Admin", [UserRoleType.APPLICATION_ADMIN], system));
        var teacher = InTenant(User.Create(tenant.Id, "dev-teacher", "teacher@demo-school.local", "Tarek Teacher", [UserRoleType.TEACHER], system));
        var parent = InTenant(User.Create(tenant.Id, "dev-parent", "parent@demo-school.local", "Paula Parent", [UserRoleType.PARENT], system));
        var student = InTenant(User.Create(tenant.Id, "dev-student", "student@demo-school.local", "Sara Student", [UserRoleType.STUDENT], system));
        var classmate = InTenant(User.Create(tenant.Id, "dev-student-2", "student2@demo-school.local", "Omar Student", [UserRoleType.STUDENT], system));
        db.Users.AddRange(admin, teacher, parent, student, classmate);

        // ---- school structure ----
        var science = InTenant(Subject.Create("Science", "#2E7D32", system));
        var math = InTenant(Subject.Create("Math", "#1565C0", system));
        var primary = InTenant(Stage.Create("Primary", 1, system));
        db.AddRange(science, math, primary);
        await db.SaveChangesAsync(ct);

        var grade4 = InTenant(Grade.Create(primary, "Grade 4", 4, system));
        var rosterTeacher = InTenant(Teacher.Create("Tarek", "Teacher", teacher.Email, null, [science], system));
        db.AddRange(grade4, rosterTeacher);
        await db.SaveChangesAsync(ct);

        var class4A = InTenant(ClassGroup.Create(grade4, "4A", [rosterTeacher], [science, math], system));
        db.Add(class4A);
        await db.SaveChangesAsync(ct);

        teacher.LinkToTeacherRecord(rosterTeacher, system);
        student.PlaceInClass(class4A, system);
        student.LinkToParent(parent, system);
        classmate.PlaceInClass(class4A, system);

        // ---- question bank: one question of each type ----
        var classification = new QuestionClassification(science.Id, primary.Id, grade4.Id, Semester.First);
        var questions = new[]
        {
            new QuestionDraft(QuestionType.Choose, "Which planet is closest to the Sun?", ["Mercury", "Venus", "Earth", "Mars"], CorrectOption: 1),
            new QuestionDraft(QuestionType.RightWrong, "Water boils at 100 °C at sea level.", IsRight: true),
            new QuestionDraft(QuestionType.Complete, "Plants make their food by photosynthesis(Complete) using the energy of light(Complete)."),
            new QuestionDraft(QuestionType.Explain, SubjectHtml: "<p>Explain why the Earth has <b>seasons</b>.</p>",
                ReferenceAnswer: "<p>The Earth's axis is tilted, so each hemisphere receives more direct sunlight for part of the year.</p>",
                WeightPercent: 20)
        }.Select(draft => InTenant(Question.Create(AuthoredQuestion.From(draft), classification, system))).ToList();
        db.Questions.AddRange(questions);
        await db.SaveChangesAsync(ct);

        // ---- quizzes ----
        var bankQuiz = InTenant(BankQuiz.Create("Science Basics", "One question of every type.", QuizSettings.Default,
            new QuizPlacement(science.Id, primary.Id, grade4.Id, null, Semester.First), teacher, questions, system));
        var oneTimeJoinQuiz = InTenant(BankQuiz.Create("One Time Join Check", "A single, uninterrupted sitting.",
            new QuizSettings { OneTimeJoin = true, RequiredAll = true },
            new QuizPlacement(science.Id, primary.Id, null, null, null), teacher, questions.Take(2).ToList(), system));
        db.BankQuizzes.AddRange(bankQuiz, oneTimeJoinQuiz);

        var asTeacher = new SystemAction(QuizMasterActionType.Seed, now) { CreatedById = teacher.Id };
        var teacherQuiz = InTenant(TeacherQuiz.Create("Unit 4 Review", "Tarek's review quiz.", QuizSettings.Default, science, primary.Id, Semester.First,
            AuthoredQuestion.FromAll(
            [
                new QuestionDraft(QuestionType.Choose, "What gas do plants take in?", ["Oxygen", "Carbon dioxide", "Nitrogen"], CorrectOption: 2),
                new QuestionDraft(QuestionType.RightWrong, "The Moon makes its own light.", IsRight: false)
            ]), asTeacher));
        db.TeacherQuizzes.Add(teacherQuiz);
        await db.SaveChangesAsync(ct);

        var homework = InTenant(HomeworkAssignment.Create("Week 1: Unit 4 Review", AssignmentKind.Homework, QuizReference.To(teacherQuiz),
            class4A, science.Id, Semester.First, now.AddDays(7), [], asTeacher));
        db.Assignments.Add(homework);
        await db.SaveChangesAsync(ct);

        // ---- registration keys: Paula's family key (Sara is on it, room for two more), one unclaimed parent key, one admin key ----
        var familyKey = InTenant(RegistrationKey.Create(UserRoleType.PARENT, now.AddYears(1), 3, system));
        var openParentKey = InTenant(RegistrationKey.Create(UserRoleType.PARENT, now.AddYears(1), 2, system));
        var adminKey = InTenant(RegistrationKey.Create(UserRoleType.APPLICATION_ADMIN, null, null, system));
        db.RegistrationKeys.AddRange(familyKey, openParentKey, adminKey);
        await db.SaveChangesAsync(ct);

        familyKey.ClaimFor(parent, system);
        familyKey.SpendChildSlot(parent.Id, now, system);
        parent.HoldRegistrationKey(familyKey, system);
        student.HoldRegistrationKey(familyKey, system);
        await db.SaveChangesAsync(ct);
    }

    // A platform administrator for the dev token tool ("dev-platform"): belongs to no organization (TenantId 0). Its own
    // address, because platform@quizmasterpro.local is the first-run administrator's (FirstRunSeed) and a sign-in email
    // names one account platform-wide.
    private static async Task SeedPlatformAdministratorAsync(QuizMasterDbContext db, CancellationToken ct)
    {
        const string uid = "dev-platform";
        if (await db.Users.IgnoreQueryFilters().AnyAsync(user => user.SignInUid == uid, ct))
            return;

        var system = new SystemAction(QuizMasterActionType.Seed, DateTime.UtcNow);
        db.Users.Add(User.Create(0, uid, "dev-platform@quizmasterpro.local", "Pat Platform", [UserRoleType.PLATFORM_ADMIN], system));
        await db.SaveChangesAsync(ct);
    }
}
