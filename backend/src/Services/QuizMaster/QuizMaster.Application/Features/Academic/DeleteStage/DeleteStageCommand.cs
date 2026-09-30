namespace QuizMaster.Application.Features.Academic.DeleteStage;

// Refused with 409 Conflict while anything still refers to it (the database's foreign keys decide).
public record DeleteStageCommand : QuizMasterCommand
{
    public override QuizMasterActionType ActionType => QuizMasterActionType.DeleteStage;
}

public class DeleteStageCommandValidator : QuizMasterCommandValidator<DeleteStageCommand>;
