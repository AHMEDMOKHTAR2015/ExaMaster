namespace QuizMaster.Application.Features.Participations.DeleteParticipation;

// Administrators only. A student's completion history and attempt count are derived from participations,
// so nothing else needs correcting (the app had to rewrite two denormalized copies on the user document).
public record DeleteParticipationCommand : QuizMasterCommand
{
    public override QuizMasterActionType ActionType => QuizMasterActionType.DeleteParticipation;
}

public class DeleteParticipationCommandValidator : QuizMasterCommandValidator<DeleteParticipationCommand>;
