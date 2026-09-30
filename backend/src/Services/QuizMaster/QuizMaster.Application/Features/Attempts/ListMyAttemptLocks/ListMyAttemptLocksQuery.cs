namespace QuizMaster.Application.Features.Attempts.ListMyAttemptLocks;

// Every lock the caller holds, read once when their quiz list loads so each card can show a padlock without a call per card.
public record ListMyAttemptLocksQuery : IQuery<ListMyAttemptLocksResponse>;
public record ListMyAttemptLocksResponse(IReadOnlyList<AttemptLockDto> Locks);
