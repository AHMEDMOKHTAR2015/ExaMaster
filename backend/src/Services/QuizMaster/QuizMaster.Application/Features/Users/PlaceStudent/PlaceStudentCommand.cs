namespace QuizMaster.Application.Features.Users.PlaceStudent;

// Puts a student in a class; their stage and grade follow from it.
public record PlaceStudentCommand(int ClassId) : QuizMasterCommand
{
    public override QuizMasterActionType ActionType => QuizMasterActionType.PlaceStudent;
}

public class PlaceStudentCommandValidator : QuizMasterCommandValidator<PlaceStudentCommand>
{
    public PlaceStudentCommandValidator()
        => RuleFor(c => c.ClassId).GreaterThan(0).WithMessageForInvalidId(nameof(PlaceStudentCommand.ClassId));
}
