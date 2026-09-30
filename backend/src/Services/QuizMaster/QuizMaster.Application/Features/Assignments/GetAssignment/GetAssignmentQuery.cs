namespace QuizMaster.Application.Features.Assignments.GetAssignment;

// Staff see any assignment; a student only one set for them, a parent only one set for one of their children.
public record GetAssignmentQuery(int Id) : IQuery<GetAssignmentResponse>;
public record GetAssignmentResponse(AssignmentDto Assignment);

public class GetAssignmentQueryValidator : AbstractValidator<GetAssignmentQuery>
{
    public GetAssignmentQueryValidator()
        => RuleFor(q => q.Id).GreaterThan(0).WithMessageForInvalidId(nameof(GetAssignmentQuery.Id));
}
