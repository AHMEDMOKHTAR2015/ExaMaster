namespace QuizMaster.Application.Features.Assignments.GetAssignmentSitting;

// The assignment's quiz ready to sit, WITHOUT answers. A student gets it only while the assignment is open to them.
public record GetAssignmentSittingQuery(int Id) : IQuery<SittingDto>;

public class GetAssignmentSittingQueryValidator : AbstractValidator<GetAssignmentSittingQuery>
{
    public GetAssignmentSittingQueryValidator()
        => RuleFor(q => q.Id).GreaterThan(0).WithMessageForInvalidId(nameof(GetAssignmentSittingQuery.Id));
}
