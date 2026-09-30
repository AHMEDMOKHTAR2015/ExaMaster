using QuizMaster.Application.Features.Attempts.Shared;

namespace QuizMaster.Application.Features.Assignments.GetAssignmentSitting;

public class GetAssignmentSittingQueryHandler(AttemptedQuizLoader _quizLoader, Repository<User> _userRepository, IClaimsProvider _claimsProvider)
    : IRequestHandler<GetAssignmentSittingQuery, SittingDto>
{
    public async Task<SittingDto> Handle(GetAssignmentSittingQuery query, CancellationToken ct)
    {
        var caller = Caller.From(_claimsProvider);
        var (quiz, homework) = await _quizLoader.LoadAsync(new AssignmentTarget(query.Id), ct);

        if (!caller.IsStaff)
            homework!.EnsureOpenFor(await _userRepository.GetByIdOrThrowAsync(caller.UserId, ct));

        return SittingDto.From(quiz, homework);
    }

    private sealed record AssignmentTarget(int? HomeworkId) : IAttemptTarget
    {
        public int? BankQuizId => null;
        public int? TeacherQuizId => null;
    }
}
