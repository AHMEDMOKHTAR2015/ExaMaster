using QuizMaster.Application.Features.Participations.Shared;

namespace QuizMaster.Application.Features.Participations.GetParticipation;

public class GetParticipationQueryHandler(
    ParticipationRepository _participationRepository, Repository<HomeworkAssignment> _assignmentRepository, IClaimsProvider _claimsProvider)
    : IRequestHandler<GetParticipationQuery, GetParticipationResponse>
{
    public async Task<GetParticipationResponse> Handle(GetParticipationQuery query, CancellationToken ct)
    {
        var caller = Caller.From(_claimsProvider);
        var participation = Guard.NotFound(await _participationRepository.GetByIdAsync(query.Id, ct));

        if (caller.IsStaff)
            return new GetParticipationResponse(ParticipationViews.ToDto(participation, resultsAvailable: true, marksAvailable: true));

        // Read against the assignment's CURRENT due date and latest attempt: a teacher extending it, or sending it back, keeps the answers withheld longer.
        var homework = participation.HomeworkId is { } homeworkId ? await _assignmentRepository.GetByIdAsync(homeworkId, ct) : null;
        var latestAttempt = homework is null ? null : await _participationRepository.GetLatestAttemptAsync(participation.ChildId, homework.Id, ct);

        return new GetParticipationResponse(ParticipationViews.ToDto(
            participation,
            participation.AreResultsAvailableTo(homework, latestAttempt, DateTime.UtcNow),
            participation.AreMarksAvailableTo(homework, latestAttempt)));
    }
}
