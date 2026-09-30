namespace QuizMaster.Application.Features.Attempts.RecordAttemptExit;

public class RecordAttemptExitCommandHandler(QuizAttemptLockRepository _attemptLockRepository)
    : IRequestHandler<RecordAttemptExitCommand, IdResponse>
{
    public async Task<IdResponse> Handle(RecordAttemptExitCommand command, CancellationToken ct)
    {
        var attemptLock = await _attemptLockRepository.GetByIdOrThrowAsync(command.AggregateId, ct);

        attemptLock.RecordExit(command.Reason, command);

        await _attemptLockRepository.SaveChangesAsync(ct);

        return new IdResponse(attemptLock.Id);
    }
}
