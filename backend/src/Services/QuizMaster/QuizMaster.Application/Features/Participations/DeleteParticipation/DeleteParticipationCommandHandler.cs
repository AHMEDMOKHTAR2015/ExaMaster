namespace QuizMaster.Application.Features.Participations.DeleteParticipation;

public class DeleteParticipationCommandHandler(ParticipationRepository _participationRepository)
    : IRequestHandler<DeleteParticipationCommand, IdResponse>
{
    public async Task<IdResponse> Handle(DeleteParticipationCommand command, CancellationToken ct)
    {
        var participation = await _participationRepository.GetByIdOrThrowAsync(command.AggregateId, ct);

        _participationRepository.Remove(participation);
        await _participationRepository.SaveChangesAsync(ct);

        return new IdResponse(participation.Id);
    }
}
