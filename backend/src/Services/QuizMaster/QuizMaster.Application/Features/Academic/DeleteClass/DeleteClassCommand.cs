namespace QuizMaster.Application.Features.Academic.DeleteClass;

// Refused with 409 Conflict while anything still refers to it (the database's foreign keys decide).
public record DeleteClassCommand : QuizMasterCommand
{
    public override QuizMasterActionType ActionType => QuizMasterActionType.DeleteClass;
}

public class DeleteClassCommandValidator : QuizMasterCommandValidator<DeleteClassCommand>;
