namespace QuizMaster.Application.Features.Academic.DeleteTeacher;

// Refused with 409 Conflict while anything still refers to it (the database's foreign keys decide).
public record DeleteTeacherCommand : QuizMasterCommand
{
    public override QuizMasterActionType ActionType => QuizMasterActionType.DeleteTeacher;
}

public class DeleteTeacherCommandValidator : QuizMasterCommandValidator<DeleteTeacherCommand>;
