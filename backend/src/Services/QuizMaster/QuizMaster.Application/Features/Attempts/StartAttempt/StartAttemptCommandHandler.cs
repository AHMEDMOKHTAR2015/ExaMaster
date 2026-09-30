using QuizMaster.Application.Features.Attempts.Shared;

namespace QuizMaster.Application.Features.Attempts.StartAttempt;

public class StartAttemptCommandHandler(
    QuizAttemptLockRepository _attemptLockRepository, Repository<User> _userRepository, AttemptedQuizLoader _quizLoader)
    : IRequestHandler<StartAttemptCommand, AttemptLockDto>
{
    public async Task<AttemptLockDto> Handle(StartAttemptCommand command, CancellationToken ct)
    {
        var student = await _userRepository.GetByIdOrThrowAsync(command.CreatedById, ct);
        var (quiz, homework) = await _quizLoader.LoadAsync(command, ct);
        var existing = await _attemptLockRepository.GetForScopeAsync(student.Id, AttemptScope.KeyFor(quiz, homework), ct);

        var attemptLock = QuizAttemptLock.Begin(student, quiz, homework, existing, command);

        if (existing is null)
            await _attemptLockRepository.AddAsync(attemptLock, ct);
        await _attemptLockRepository.SaveChangesAsync(ct);

        return attemptLock.Adapt<AttemptLockDto>() with { ChildName = student.DisplayName };
    }
}
