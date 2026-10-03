using QuizMaster.Application.Features.Assignments.Shared;
using QuizMaster.Application.Features.Participations.Shared;

namespace QuizMaster.Application.Features.Participations.SearchParticipations;

// Submitted attempts, newest first. Staff see the organization's; anyone else only their own and their children's.
// A teacher's review queue (Quiz Management's Validation tab) is ReviewerId = theirs, a Verdict, and the filter bar
// (AssignmentFilter); reviewed ones come most recently reviewed first.
public record SearchParticipationsQuery(
    int? ChildId = null,
    int? HomeworkId = null,
    int? BankQuizId = null,
    int? TeacherQuizId = null,
    int? ReviewerId = null,
    bool AwaitingReview = false,
    ReviewVerdict? Verdict = null,
    int? SubjectId = null,
    Semester? Semester = null,
    int? ClassId = null,
    AssignmentKind? Kind = null,
    string? Search = null,
    int Page = 1,
    int PageSize = Paging.DefaultPageSize) : IQuery<PagedResponse<ParticipationSummaryDto>>, IPagedQuery
{
    public AssignmentFilter Filter() => new(SubjectId, Semester, ClassId, Kind, Search);
}

public class SearchParticipationsQueryValidator : AbstractValidator<SearchParticipationsQuery>
{
    public SearchParticipationsQueryValidator()
    {
        this.AddPagingRules();
        this.AddAssignmentFilterRules(query => query.Filter());
        RuleFor(query => query.Verdict).IsInEnum();
    }
}
