namespace QuizMaster.Application.Features.Attempts.ReleaseAttemptLock;

public class ReleaseAttemptLockCommandHandler(QuizAttemptLockRepository _attemptLockRepository)
    : IRequestHandler<ReleaseAttemptLockCommand, IdResponse>
{
    public async Task<IdResponse> Handle(ReleaseAttemptLockCommand command, CancellationToken ct)
    {
        var attemptLock = await _attemptLockRepository.GetByIdOrThrowAsync(command.AggregateId, ct);

        attemptLock.Release(command);

        await _attemptLockRepository.SaveChangesAsync(ct);

        return new IdResponse(attemptLock.Id);
    }
}
