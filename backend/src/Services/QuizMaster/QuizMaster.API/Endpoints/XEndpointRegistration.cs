using QuizMaster.API.Endpoints.Users;
using QuizMaster.API.Endpoints.Academic;
using QuizMaster.API.Endpoints.Questions;
using QuizMaster.API.Endpoints.Quizzes;
using QuizMaster.API.Endpoints.TeacherQuizzes;
using QuizMaster.API.Endpoints.Assignments;
using QuizMaster.API.Endpoints.Attempts;
using QuizMaster.API.Endpoints.Participations;
using QuizMaster.API.Endpoints.Dashboard;
using QuizMaster.API.Endpoints.Accounts;
using QuizMaster.API.Endpoints.Registration;
using QuizMaster.API.Endpoints.RegistrationKeys;
using QuizMaster.API.Endpoints.Notifications;
using QuizMaster.API.Endpoints.Translations;
using QuizMaster.API.Endpoints.Platform;
using QuizMaster.API.Endpoints.Auth;
using QuizMaster.API.Endpoints.AccessRequests;

namespace QuizMaster.API.Endpoints;

public static class EndpointRegistration
{
    public static IEndpointRouteBuilder MapAllEndpoints(this IEndpointRouteBuilder app)
    {
        var api = app.MapGroup("/api");

        // Users
        GetCurrentUserEndpoint.Map(api);
        GetMyChildrenEndpoint.Map(api);
        SearchUsersEndpoint.Map(api);
        GetUserEndpoint.Map(api);
        AssignUserRolesEndpoint.Map(api);
        PlaceStudentEndpoint.Map(api);
        LinkParentEndpoint.Map(api);
        LinkTeacherRecordEndpoint.Map(api);
        DeactivateUserEndpoint.Map(api);
        ActivateUserEndpoint.Map(api);
        RenameUserEndpoint.Map(api);

        // Sign-in and passwords
        SignInEndpoint.Map(api);
        RefreshSessionEndpoint.Map(api);
        SignOutEndpoint.Map(api);
        ChangeMyPasswordEndpoint.Map(api);
        SetUserPasswordEndpoint.Map(api);

        // Accounts (a profile and its sign-in, created together)
        CreateAccountEndpoint.Map(api);
        AddMyChildEndpoint.Map(api);
        ProvisionTeacherLoginEndpoint.Map(api);

        // Registration keys and self-registration
        SearchRegistrationKeysEndpoint.Map(api);
        CreateRegistrationKeyEndpoint.Map(api);
        UpdateRegistrationKeyEndpoint.Map(api);
        DeleteRegistrationKeyEndpoint.Map(api);
        RegisterEndpoint.Map(api);
        RegisterChildEndpoint.Map(api);

        // Academic
        ListStagesEndpoint.Map(api);
        CreateStageEndpoint.Map(api);
        UpdateStageEndpoint.Map(api);
        DeleteStageEndpoint.Map(api);
        ListGradesEndpoint.Map(api);
        CreateGradeEndpoint.Map(api);
        UpdateGradeEndpoint.Map(api);
        DeleteGradeEndpoint.Map(api);
        ListClassesEndpoint.Map(api);
        CreateClassEndpoint.Map(api);
        UpdateClassEndpoint.Map(api);
        DeleteClassEndpoint.Map(api);
        ListSubjectsEndpoint.Map(api);
        CreateSubjectEndpoint.Map(api);
        UpdateSubjectEndpoint.Map(api);
        DeleteSubjectEndpoint.Map(api);
        ListTeachersEndpoint.Map(api);
        CreateTeacherEndpoint.Map(api);
        UpdateTeacherEndpoint.Map(api);
        DeleteTeacherEndpoint.Map(api);

        // Questions
        SearchQuestionsEndpoint.Map(api);
        GetQuestionEndpoint.Map(api);
        CreateQuestionEndpoint.Map(api);
        CreateQuestionsEndpoint.Map(api);
        ReclassifyQuestionsEndpoint.Map(api);
        TagQuestionEndpoint.Map(api);
        RetagQuestionsEndpoint.Map(api);
        UpdateQuestionEndpoint.Map(api);
        DeleteQuestionEndpoint.Map(api);

        // Quizzes
        ListBankQuizzesEndpoint.Map(api);
        GetBankQuizEndpoint.Map(api);
        GetBankQuizSittingEndpoint.Map(api);
        CreateBankQuizEndpoint.Map(api);
        UpdateBankQuizEndpoint.Map(api);
        DeleteBankQuizEndpoint.Map(api);

        // TeacherQuizzes
        ListTeacherQuizzesEndpoint.Map(api);
        GetTeacherQuizEndpoint.Map(api);
        GetTeacherQuizSittingEndpoint.Map(api);
        CreateTeacherQuizEndpoint.Map(api);
        UpdateTeacherQuizEndpoint.Map(api);
        DeleteTeacherQuizEndpoint.Map(api);

        // Assignments
        ListAssignmentsEndpoint.Map(api);
        GetAssignmentEndpoint.Map(api);
        GetAssignmentSittingEndpoint.Map(api);
        CreateAssignmentEndpoint.Map(api);
        UpdateAssignmentEndpoint.Map(api);
        DeleteAssignmentEndpoint.Map(api);

        // Attempts
        StartAttemptEndpoint.Map(api);
        ListMyAttemptLocksEndpoint.Map(api);
        ListAttemptLocksEndpoint.Map(api);
        RecordAttemptExitEndpoint.Map(api);
        ReleaseAttemptLockEndpoint.Map(api);
        ResetAttemptLockEndpoint.Map(api);
        SubmitQuizEndpoint.Map(api);

        // Participations
        SearchParticipationsEndpoint.Map(api);
        GetParticipationEndpoint.Map(api);
        ReviewSubmissionEndpoint.Map(api);
        DeleteParticipationEndpoint.Map(api);
        ListReviewQueueEndpoint.Map(api);

        // Notifications
        ListMyNotificationsEndpoint.Map(api);
        MarkNotificationReadEndpoint.Map(api);
        MarkAllNotificationsReadEndpoint.Map(api);

        // Translation overrides
        GetTranslationOverridesEndpoint.Map(api);
        SaveTranslationOverridesEndpoint.Map(api);
        ResetTranslationOverridesEndpoint.Map(api);

        // Platform (the vendor: organizations, never data inside one)
        ListTenantsEndpoint.Map(api);
        GetTenantEndpoint.Map(api);
        CreateTenantEndpoint.Map(api);
        UpdateTenantEndpoint.Map(api);
        SuspendTenantEndpoint.Map(api);
        SetAdministratorPasswordEndpoint.Map(api);
        ReactivateTenantEndpoint.Map(api);

        // Access requests (a visitor asks; the platform administrator decides, and places the account in an organization)
        SubmitAccessRequestEndpoint.Map(api);
        ListAccessRequestsEndpoint.Map(api);
        ApproveAccessRequestEndpoint.Map(api);
        RejectAccessRequestEndpoint.Map(api);
        ListTenantClassesEndpoint.Map(api);
        SearchTenantParentsEndpoint.Map(api);

        // Dashboard
        GetDashboardStatsEndpoint.Map(api);
        GetClassStatsEndpoint.Map(api);
        GetMySubjectPerformanceEndpoint.Map(api);

        return app;
    }
}
