namespace QuizMaster.Application.Features.Participations.GetParticipation;

// One attempt, answer by answer. Staff always see the correct answers; a student or parent only once the assignment is due.
public record GetParticipationQuery(int Id) : IQuery<GetParticipationResponse>;
public record GetParticipationResponse(ParticipationDto Participation);

public class GetParticipationQueryValidator : AbstractValidator<GetParticipationQuery>
{
    public GetParticipationQueryValidator()
        => RuleFor(q => q.Id).GreaterThan(0).WithMessageForInvalidId(nameof(GetParticipationQuery.Id));
}
