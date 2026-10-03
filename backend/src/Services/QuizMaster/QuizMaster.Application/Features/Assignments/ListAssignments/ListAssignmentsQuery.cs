using QuizMaster.Application.Features.Assignments.Shared;

namespace QuizMaster.Application.Features.Assignments.ListAssignments;

// What each caller sees:
//   student  the active assignments set for them, each with their latest attempt
//   parent   the same for one of their children (ChildId required)
//   staff    everything in the organization, narrowed by Mine (authored by the caller) / IncludeInactive and Quiz
//            Management's filter bar (AssignmentFilter: subject, semester, group, kind, search)
public record ListAssignmentsQuery(
    int? ClassId = null,
    int? ChildId = null,
    bool Mine = false,
    bool IncludeInactive = false,
    int? SubjectId = null,
    Semester? Semester = null,
    AssignmentKind? Kind = null,
    string? Search = null) : IQuery<ListAssignmentsResponse>
{
    public AssignmentFilter Filter() => new(SubjectId, Semester, ClassId, Kind, Search);
}

public class ListAssignmentsQueryValidator : AbstractValidator<ListAssignmentsQuery>
{
    public ListAssignmentsQueryValidator() => this.AddAssignmentFilterRules(query => query.Filter());
}
public record ListAssignmentsResponse(IReadOnlyList<AssignmentDto> Assignments);
