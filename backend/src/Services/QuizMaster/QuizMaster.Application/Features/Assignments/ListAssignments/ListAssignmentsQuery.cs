namespace QuizMaster.Application.Features.Assignments.ListAssignments;

// What each caller sees:
//   student  the active assignments set for them, each with their latest attempt
//   parent   the same for one of their children (ChildId required)
//   staff    everything in the organization, narrowed by ClassId / Mine (authored by the caller) / IncludeInactive
public record ListAssignmentsQuery(int? ClassId = null, int? ChildId = null, bool Mine = false, bool IncludeInactive = false)
    : IQuery<ListAssignmentsResponse>;
public record ListAssignmentsResponse(IReadOnlyList<AssignmentDto> Assignments);
