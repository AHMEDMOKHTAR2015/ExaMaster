namespace QuizMaster.Application.Features.Questions.DeleteQuestion;

// The question drops out of every bank quiz that used it; past attempts keep their snapshot of it.
public record DeleteQuestionCommand : QuizMasterCommand
{
    public override QuizMasterActionType ActionType => QuizMasterActionType.DeleteQuestion;
}

public class DeleteQuestionCommandValidator : QuizMasterCommandValidator<DeleteQuestionCommand>;
