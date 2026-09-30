namespace QuizMaster.Application.Features.Academic.CreateClass;

// A class of students inside a grade, with the roster teachers assigned to it and the subjects it studies.
public record CreateClassCommand(int GradeId, string Name, List<int>? TeacherIds, List<int>? SubjectIds) : QuizMasterCommand
{
    public override QuizMasterActionType ActionType => QuizMasterActionType.CreateClass;
}

public class CreateClassCommandValidator : AbstractValidator<CreateClassCommand>
{
    public CreateClassCommandValidator()
    {
        RuleFor(c => c.GradeId).GreaterThan(0).WithMessageForInvalidId(nameof(CreateClassCommand.GradeId));
        RuleFor(c => c.Name).NotEmptyWithMessage(nameof(CreateClassCommand.Name)).MaximumLengthWithMessage(MaxLength.C128, nameof(CreateClassCommand.Name));
    }
}
