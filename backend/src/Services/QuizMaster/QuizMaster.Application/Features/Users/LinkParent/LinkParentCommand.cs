namespace QuizMaster.Application.Features.Users.LinkParent;

// Links a student account to their parent's account (the parent then sees the child's work).
public record LinkParentCommand(int ParentId) : QuizMasterCommand
{
    public override QuizMasterActionType ActionType => QuizMasterActionType.LinkParent;
}

public class LinkParentCommandValidator : QuizMasterCommandValidator<LinkParentCommand>
{
    public LinkParentCommandValidator()
        => RuleFor(c => c.ParentId).GreaterThan(0).WithMessageForInvalidId(nameof(LinkParentCommand.ParentId));
}
