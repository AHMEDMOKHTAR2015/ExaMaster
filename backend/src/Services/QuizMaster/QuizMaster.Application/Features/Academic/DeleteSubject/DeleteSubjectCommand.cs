namespace QuizMaster.Application.Features.Academic.DeleteSubject;

// Refused with 409 Conflict while anything still refers to it (the database's foreign keys decide).
public record DeleteSubjectCommand : QuizMasterCommand
{
    public override QuizMasterActionType ActionType => QuizMasterActionType.DeleteSubject;
}

public class DeleteSubjectCommandValidator : QuizMasterCommandValidator<DeleteSubjectCommand>;
