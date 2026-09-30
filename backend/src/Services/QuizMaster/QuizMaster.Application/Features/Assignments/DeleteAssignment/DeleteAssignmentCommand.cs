namespace QuizMaster.Application.Features.Assignments.DeleteAssignment;

// Its attempt locks go with it; its submissions stay, carrying the assignment's title.
public record DeleteAssignmentCommand : QuizMasterCommand
{
    public override QuizMasterActionType ActionType => QuizMasterActionType.DeleteAssignment;
}

public class DeleteAssignmentCommandValidator : QuizMasterCommandValidator<DeleteAssignmentCommand>;
