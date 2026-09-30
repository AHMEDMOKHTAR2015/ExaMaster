namespace QuizMaster.Application.Features.Academic.DeleteGrade;

// Refused with 409 Conflict while anything still refers to it (the database's foreign keys decide).
public record DeleteGradeCommand : QuizMasterCommand
{
    public override QuizMasterActionType ActionType => QuizMasterActionType.DeleteGrade;
}

public class DeleteGradeCommandValidator : QuizMasterCommandValidator<DeleteGradeCommand>;
