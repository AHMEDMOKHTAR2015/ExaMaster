namespace QuizMaster.Application.Features.Participations.SearchParticipations;

// Submitted attempts, newest first. Staff see the organization's; anyone else only their own and their children's.
public record SearchParticipationsQuery(
    int? ChildId = null,
    int? HomeworkId = null,
    int? BankQuizId = null,
    int? TeacherQuizId = null,
    int? ReviewerId = null,
    bool AwaitingReview = false,
    int Page = 1,
    int PageSize = Paging.DefaultPageSize) : IQuery<PagedResponse<ParticipationSummaryDto>>, IPagedQuery;

public class SearchParticipationsQueryValidator : AbstractValidator<SearchParticipationsQuery>
{
    public SearchParticipationsQueryValidator() => this.AddPagingRules();
}
