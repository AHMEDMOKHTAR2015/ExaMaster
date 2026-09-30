namespace QuizMaster.Application.Features.Attempts.ResetAttemptLock;

public class ResetAttemptLockCommandHandler(QuizAttemptLockRepository _attemptLockRepository)
    : IRequestHandler<ResetAttemptLockCommand, IdResponse>
{
    public async Task<IdResponse> Handle(ResetAttemptLockCommand command, CancellationToken ct)
    {
        var attemptLock = await _attemptLockRepository.GetByIdOrThrowAsync(command.AggregateId, ct);

        _attemptLockRepository.Remove(attemptLock);
        await _attemptLockRepository.SaveChangesAsync(ct);

        return new IdResponse(attemptLock.Id);
    }
}
