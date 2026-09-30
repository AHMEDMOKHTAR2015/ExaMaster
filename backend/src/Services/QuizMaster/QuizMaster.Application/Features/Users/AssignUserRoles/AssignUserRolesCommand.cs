namespace QuizMaster.Application.Features.Users.AssignUserRoles;

// Replaces the user's roles. Takes effect on their very next request.
public record AssignUserRolesCommand(List<UserRoleType> Roles) : QuizMasterCommand
{
    public override QuizMasterActionType ActionType => QuizMasterActionType.AssignUserRoles;
}

public class AssignUserRolesCommandValidator : QuizMasterCommandValidator<AssignUserRolesCommand>
{
    public AssignUserRolesCommandValidator()
    {
        RuleFor(c => c.Roles).NotNullWithMessage();
        RuleForEach(c => c.Roles).IsInEnum();
    }
}
