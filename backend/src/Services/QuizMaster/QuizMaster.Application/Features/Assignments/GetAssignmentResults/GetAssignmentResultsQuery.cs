using QuizMaster.Application.Features.Assignments.Shared;

namespace QuizMaster.Application.Features.Assignments.GetAssignmentResults;

// Quiz Management's Results tab: how far the students of each of the caller's assignments have got (AssignmentProgress),
// for the assignments the filter bar selects (AssignmentFilter), active or not. Worked out here from the submissions
// rather than by the browser reading every submission to every assignment.
public record GetAssignmentResultsQuery(
    int? SubjectId = null,
    Semester? Semester = null,
    int? ClassId = null,
    AssignmentKind? Kind = null,
    string? Search = null) : IQuery<GetAssignmentResultsResponse>
{
    public AssignmentFilter Filter() => new(SubjectId, Semester, ClassId, Kind, Search);
}

public record GetAssignmentResultsResponse(IReadOnlyList<AssignmentResultDto> Results);

// SubjectId / Semester: the assignment's own, else its quiz's — what the tab groups the results by.
public record AssignmentResultDto(
    int AssignmentId,
    int? SubjectId,
    Semester? Semester,
    int Targeted,
    int Completed,
    int NotStarted,
    int Overdue,
    int Validated,
    int CompletionRate,
    int AverageScore);

public class GetAssignmentResultsQueryValidator : AbstractValidator<GetAssignmentResultsQuery>
{
    public GetAssignmentResultsQueryValidator() => this.AddAssignmentFilterRules(query => query.Filter());
}
