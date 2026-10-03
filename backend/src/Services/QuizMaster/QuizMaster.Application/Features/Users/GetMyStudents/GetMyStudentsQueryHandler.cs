namespace QuizMaster.Application.Features.Users.GetMyStudents;

public class GetMyStudentsQueryHandler(QuizMasterDbContext _dbContext, IClaimsProvider _claimsProvider)
    : IRequestHandler<GetMyStudentsQuery, GetMyStudentsResponse>
{
    public async Task<GetMyStudentsResponse> Handle(GetMyStudentsQuery query, CancellationToken ct)
    {
        var callerId = _claimsProvider.GetUserId();
        var teacher = await FindTeacherRecordAsync(callerId, ct);
        if (teacher is null)
            return new GetMyStudentsResponse([]);

        // a school has a handful of classes: filtering them in memory keeps the one teaching rule in the domain
        var classes = (await _dbContext.Classes.AsNoTracking().ToListAsync(ct))
            .Where(classGroup => classGroup.IsTaughtBy(teacher))
            .ToDictionary(classGroup => classGroup.Id);
        if (classes.Count == 0)
            return new GetMyStudentsResponse([]);

        var classIds = classes.Keys.ToList();
        var students = await _dbContext.Users.AsNoTracking()
            .Where(user => user.ClassId != null && classIds.Contains(user.ClassId.Value)
                && user.IsActive && user.Roles.Contains(UserRoleType.STUDENT))
            .ToListAsync(ct);

        var parentIds = students.Where(student => student.ParentId != null).Select(student => student.ParentId!.Value).Distinct().ToList();
        var parentNames = await _dbContext.Users.AsNoTracking().Where(parent => parentIds.Contains(parent.Id))
            .ToDictionaryAsync(parent => parent.Id, parent => parent.DisplayName, ct);

        var studentIds = students.Select(student => student.Id).ToList();
        var submissions = await _dbContext.Participations.AsNoTracking()
            .Where(participation => studentIds.Contains(participation.ChildId))
            .Select(participation => new
            {
                participation.ChildId,
                participation.EndedOn,
                participation.HomeworkId,
                Assignment = _dbContext.Assignments
                    .Where(assignment => assignment.Id == participation.HomeworkId)
                    .Select(assignment => new { assignment.Kind, assignment.CreatedById, assignment.SubjectId })
                    .FirstOrDefault(),
                TeacherQuizSubjectId = _dbContext.TeacherQuizzes
                    .Where(quiz => quiz.Id == participation.TeacherQuizId).Select(quiz => (int?)quiz.SubjectId).FirstOrDefault(),
                BankQuizSubjectId = _dbContext.BankQuizzes
                    .Where(quiz => quiz.Id == participation.BankQuizId).Select(quiz => quiz.SubjectId).FirstOrDefault()
            })
            .ToListAsync(ct);

        // only this teacher's work: one of their subjects (the assignment's, else the quiz's), or an assignment they set
        var teacherSubjectIds = teacher.SubjectIds.ToHashSet();
        var mine = submissions
            .Where(submission => submission.Assignment?.CreatedById == callerId
                || (submission.Assignment?.SubjectId ?? submission.TeacherQuizSubjectId ?? submission.BankQuizSubjectId) is { } subjectId
                    && teacherSubjectIds.Contains(subjectId))
            .Select(submission => new
            {
                submission.ChildId,
                submission.EndedOn,
                // the kind the student sees (My Participations): no assignment, or a quiz-kind one, is a quiz
                IsHomework = submission.HomeworkId != null && submission.Assignment?.Kind != AssignmentKind.Quiz
            })
            .ToLookup(submission => submission.ChildId);

        var stageIds = classes.Values.Select(classGroup => classGroup.StageId).Distinct().ToList();
        var gradeIds = classes.Values.Select(classGroup => classGroup.GradeId).Distinct().ToList();
        var stageNames = await _dbContext.Stages.AsNoTracking().Where(stage => stageIds.Contains(stage.Id))
            .ToDictionaryAsync(stage => stage.Id, stage => stage.Name, ct);
        var gradeNames = await _dbContext.Grades.AsNoTracking().Where(grade => gradeIds.Contains(grade.Id))
            .ToDictionaryAsync(grade => grade.Id, grade => grade.Name, ct);

        var result = students
            .Select(student =>
            {
                var classGroup = classes[student.ClassId!.Value];
                var work = mine[student.Id].ToList();
                return new MyStudentDto(
                    student.Adapt<UserDto>(),
                    student.ParentId is { } parentId ? parentNames.GetValueOrDefault(parentId) : null,
                    stageNames.GetValueOrDefault(classGroup.StageId),
                    gradeNames.GetValueOrDefault(classGroup.GradeId),
                    classGroup.Name,
                    QuizCount: work.Count(submission => !submission.IsHomework),
                    HomeworkCount: work.Count(submission => submission.IsHomework),
                    LastSubmittedOn: work.Count == 0 ? null : work.Max(submission => submission.EndedOn));
            })
            .OrderBy(row => row.ClassName).ThenBy(row => row.Student.DisplayName).ThenBy(row => row.Student.Id)
            .ToList();

        return new GetMyStudentsResponse(result);
    }

    // The caller's roster record: the one their account is linked to, else the one with their email (as the app links them).
    private async Task<Teacher?> FindTeacherRecordAsync(int callerId, CancellationToken ct)
    {
        var account = await _dbContext.Users.AsNoTracking()
            .Where(user => user.Id == callerId)
            .Select(user => new { user.TeacherId, user.Email })
            .SingleAsync(ct);

        if (account.TeacherId is { } teacherId
            && await _dbContext.Teachers.AsNoTracking().SingleOrDefaultAsync(teacher => teacher.Id == teacherId, ct) is { } linked)
            return linked;

        return await _dbContext.Teachers.AsNoTracking()
            .Where(teacher => teacher.Email == account.Email)
            .OrderBy(teacher => teacher.Id)
            .FirstOrDefaultAsync(ct);
    }
}
