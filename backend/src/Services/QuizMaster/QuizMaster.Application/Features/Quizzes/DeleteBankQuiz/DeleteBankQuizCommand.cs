namespace QuizMaster.Application.Features.Quizzes.DeleteBankQuiz;

// Refused (409) while an assignment still sets the quiz: students would be left with work they cannot open.
// Past attempts survive the deletion; they carry the quiz's name.
public record DeleteBankQuizCommand : QuizMasterCommand
{
    public override QuizMasterActionType ActionType => QuizMasterActionType.DeleteQuiz;
}

public class DeleteBankQuizCommandValidator : QuizMasterCommandValidator<DeleteBankQuizCommand>;
