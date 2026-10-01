namespace QuizMaster.Domain.Shared.Enums;

// One verb per command. It is the audit "what" of every action.
public enum QuizMasterActionType
{
    // System
    Seed,

    // Organizations (platform administrators only)
    CreateTenant,
    UpdateTenant,
    SuspendTenant,
    ReactivateTenant,

    // Users
    AssignUserRoles,
    PlaceStudent,
    LinkParent,
    LinkTeacherRecord,
    ActivateUser,
    DeactivateUser,
    RenameUser,
    CreateAccount,
    ProvisionTeacherLogin,

    // Registration keys and self-registration
    CreateRegistrationKey,
    UpdateRegistrationKey,
    DeleteRegistrationKey,
    Register,
    RegisterChild,
    AddChild,

    // Academic structure
    CreateStage,
    UpdateStage,
    DeleteStage,
    CreateGrade,
    UpdateGrade,
    DeleteGrade,
    CreateClass,
    UpdateClass,
    DeleteClass,
    CreateSubject,
    UpdateSubject,
    DeleteSubject,
    CreateTeacher,
    UpdateTeacher,
    DeleteTeacher,

    // Question bank
    CreateQuestion,
    UpdateQuestion,
    DeleteQuestion,
    ReclassifyQuestions,
    CreateQuiz,
    UpdateQuiz,
    DeleteQuiz,

    // Teacher-authored quizzes
    CreateTeacherQuiz,
    UpdateTeacherQuiz,
    DeleteTeacherQuiz,

    // Assignments
    CreateAssignment,
    UpdateAssignment,
    DeleteAssignment,

    // Sitting a quiz
    StartAttempt,
    RecordAttemptExit,
    ReleaseAttemptLock,
    ResetAttemptLock,
    SubmitQuiz,

    // Review
    ReviewSubmission,
    DeleteParticipation,

    // Notifications
    MarkNotificationsRead,

    // Translation overrides
    SaveTranslationOverrides,
    ResetTranslationOverrides,

    // Passwords (sign-in itself is not an action on anything)
    ChangeMyPassword,
    SetUserPassword,
    SetAdministratorPassword,

    // Access requests (a visitor asks; the platform administrator decides)
    SubmitAccessRequest,
    ApproveAccessRequest,
    RejectAccessRequest,
}
