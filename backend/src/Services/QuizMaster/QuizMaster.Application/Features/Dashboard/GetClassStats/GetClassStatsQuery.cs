namespace QuizMaster.Application.Features.Dashboard.GetClassStats;

// The teacher dashboard's roster and average-score tiles for one class (the app's classStats aggregate).
public record GetClassStatsQuery(int Id) : IQuery<ClassStatsResponse>;

public record ClassStatsResponse(int ClassId, int Students, int Submissions, double? AverageScorePercent, int AwaitingReview);

public class GetClassStatsQueryValidator : AbstractValidator<GetClassStatsQuery>
{
    public GetClassStatsQueryValidator()
        => RuleFor(q => q.Id).GreaterThan(0).WithMessageForInvalidId(nameof(GetClassStatsQuery.Id));
}
