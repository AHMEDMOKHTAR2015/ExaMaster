namespace QuizMaster.Application.Features.AccessRequests.ApproveAccessRequest;

// The platform administrator turning a request into an account, in the organization they choose.
// A parent gets a family registration key of their own (MaxChildren slots, null = unlimited), as if they had registered
// with one, so they can add their children afterwards. A child needs a class and a parent of that organization, and
// spends one slot of that parent's key, exactly as a parent adding a child does.
public record ApproveAccessRequestCommand(int TenantId, int? ClassId = null, int? ParentId = null, int? MaxChildren = null)
    : QuizMasterCommand
{
    public override QuizMasterActionType ActionType => QuizMasterActionType.ApproveAccessRequest;
}

public class ApproveAccessRequestCommandValidator : QuizMasterCommandValidator<ApproveAccessRequestCommand>
{
    public ApproveAccessRequestCommandValidator()
    {
        RuleFor(c => c.TenantId).GreaterThan(0).WithMessageForInvalidId(nameof(ApproveAccessRequestCommand.TenantId));
        RuleFor(c => c.ClassId).GreaterThan(0).WithMessageForInvalidId(nameof(ApproveAccessRequestCommand.ClassId)).When(c => c.ClassId is not null);
        RuleFor(c => c.ParentId).GreaterThan(0).WithMessageForInvalidId(nameof(ApproveAccessRequestCommand.ParentId)).When(c => c.ParentId is not null);
        RuleFor(c => c.MaxChildren).InclusiveBetween(0, 50).When(c => c.MaxChildren is not null);
    }
}
