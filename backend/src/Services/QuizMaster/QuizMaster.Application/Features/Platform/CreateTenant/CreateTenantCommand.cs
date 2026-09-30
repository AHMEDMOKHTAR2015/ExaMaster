using QuizMaster.Application.Features.Accounts.Shared;

namespace QuizMaster.Application.Features.Platform.CreateTenant;

// Onboard a client: the organization and the administrator who will set it up (stages, classes, keys, …).
//insight - the only way an organization comes into being, and the only place a person is created in an organization
// the caller does not belong to: that privilege is why this is the platform administrator's and nobody else's
public record CreateTenantCommand(string Slug, string Name, TenantPlan Plan, string AdminEmail, string? AdminPassword)
    : QuizMasterCommand<CreateTenantResponse>
{
    public override QuizMasterActionType ActionType => QuizMasterActionType.CreateTenant;
}

// GeneratedPassword is present only when the server chose it; it is shown once and never stored.
public record CreateTenantResponse(int TenantId, string Slug, int AdminUserId, string AdminEmail, string? GeneratedPassword);

public class CreateTenantCommandValidator : AbstractValidator<CreateTenantCommand>
{
    public CreateTenantCommandValidator()
    {
        RuleFor(c => c.Slug).NotEmptyWithMessage(nameof(CreateTenantCommand.Slug)).MaximumLengthWithMessage(Tenant.MaxSlugLength, nameof(CreateTenantCommand.Slug));
        RuleFor(c => c.Name).NotEmptyWithMessage(nameof(CreateTenantCommand.Name)).MaximumLengthWithMessage(MaxLength.C128, nameof(CreateTenantCommand.Name));
        RuleFor(c => c.Plan).IsInEnum();
        RuleFor(c => c.AdminEmail).NotEmptyWithMessage(nameof(CreateTenantCommand.AdminEmail)).EmailAddress().MaximumLengthWithMessage(MaxLength.C256, nameof(CreateTenantCommand.AdminEmail));
        RuleFor(c => c.AdminPassword).MinimumLength(SignInEmail.MinimumPasswordLength).WithMessage(SignInEmail.PasswordMessage).MaximumLength(MaxLength.C128)
            .When(c => c.AdminPassword is not null);
    }
}
