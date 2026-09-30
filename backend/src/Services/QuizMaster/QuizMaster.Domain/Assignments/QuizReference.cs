namespace QuizMaster.Domain.Assignments;

// Which quiz an assignment sets. Built only from a loaded aggregate, so it always points at a quiz that exists.
public sealed record QuizReference
{
    private QuizReference(QuizSource source, int quizId, string quizName) => (Source, QuizId, QuizName) = (source, quizId, quizName);

    public QuizSource Source { get; }
    public int QuizId { get; }
    public string QuizName { get; }

    public static QuizReference To(BankQuiz quiz) => new(QuizSource.Bank, quiz.Id, quiz.Name);
    public static QuizReference To(TeacherQuiz quiz) => new(QuizSource.Custom, quiz.Id, quiz.Name);
}
