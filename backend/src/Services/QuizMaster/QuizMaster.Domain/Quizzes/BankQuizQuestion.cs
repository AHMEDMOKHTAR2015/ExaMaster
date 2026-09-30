namespace QuizMaster.Domain.Quizzes;

// Which bank question sits at which position of a bank quiz.
public class BankQuizQuestion : Entity
{
    private BankQuizQuestion() {}

    public int BankQuizId { get; private set; }                  // set by EF through the BankQuiz.Questions relationship
    public int QuestionId { get; private set; }
    public int Position { get; private set; }

    internal static BankQuizQuestion Create(int questionId, int position) => new() { QuestionId = questionId, Position = position };
}
