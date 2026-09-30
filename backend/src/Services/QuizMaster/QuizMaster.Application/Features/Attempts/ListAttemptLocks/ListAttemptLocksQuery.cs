namespace QuizMaster.Application.Features.Attempts.ListAttemptLocks;

// Staff: who is inside a quiz, who walked out of one, and who was let back in (Quiz Management -> Participation).
public record ListAttemptLocksQuery(int? HomeworkId = null, int? ChildId = null, bool BlockingOnly = false) : IQuery<ListAttemptLocksResponse>;
public record ListAttemptLocksResponse(IReadOnlyList<AttemptLockDto> Locks);
