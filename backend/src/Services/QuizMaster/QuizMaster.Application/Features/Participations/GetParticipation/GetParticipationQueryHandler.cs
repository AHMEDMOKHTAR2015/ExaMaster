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

        var resultsAvailable = caller.IsStaff || await AreResultsAvailableAsync(participation, ct);

        return new GetParticipationResponse(ParticipationViews.ToDto(participation, resultsAvailable));
    }

    // Read against the assignment's CURRENT due date: a teacher extending it keeps the answers withheld longer.
    private async Task<bool> AreResultsAvailableAsync(Participation participation, CancellationToken ct)
    {
        var homework = participation.HomeworkId is { } homeworkId ? await _assignmentRepository.GetByIdAsync(homeworkId, ct) : null;
        return participation.AreResultsAvailableTo(homework, DateTime.UtcNow);
    }
}
