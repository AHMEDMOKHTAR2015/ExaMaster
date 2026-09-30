namespace QuizMaster.Domain.Quizzes;

// The quiz a student sits, whatever its source: its questions in order (with their keys) and how it is sat.
// Built by BankQuiz.ForAttempt / TeacherQuiz.ForAttempt; consumed by submission and attempt locks.
public sealed record AttemptedQuiz(
    int? BankQuizId,
    int? TeacherQuizId,
    string Name,
    QuizSettings Settings,
    int? ReviewerId,
    IReadOnlyList<IQuestionDefinition> Questions);
