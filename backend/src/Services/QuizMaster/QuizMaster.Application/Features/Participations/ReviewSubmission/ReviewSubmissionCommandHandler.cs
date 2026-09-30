namespace QuizMaster.Application.Features.Participations.ReviewSubmission;

public class ReviewSubmissionCommandHandler(ParticipationRepository _participationRepository)
    : IRequestHandler<ReviewSubmissionCommand, IdResponse>
{
    public async Task<IdResponse> Handle(ReviewSubmissionCommand command, CancellationToken ct)
    {
        var participation = await _participationRepository.GetByIdOrThrowAsync(command.AggregateId, ct);

        participation.Review(command.Marks ?? [], command.Status, command.Feedback, command);

        await _participationRepository.SaveChangesAsync(ct);

        return new IdResponse(participation.Id);
    }
}
