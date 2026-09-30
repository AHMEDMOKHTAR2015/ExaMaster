namespace QuizMaster.Application.Features.Platform.UpdateTenant;

// Name, plan and branding. Never the id (Slug): it is the organization's permanent external identity.
public record UpdateTenantCommand(string Name, TenantPlan Plan, string? LogoUrl, string? PrimaryColor) : QuizMasterCommand
{
    public override QuizMasterActionType ActionType => QuizMasterActionType.UpdateTenant;
}

public class UpdateTenantCommandValidator : QuizMasterCommandValidator<UpdateTenantCommand>
{
    public UpdateTenantCommandValidator()
    {
        RuleFor(c => c.Name).NotEmptyWithMessage(nameof(UpdateTenantCommand.Name)).MaximumLengthWithMessage(MaxLength.C128, nameof(UpdateTenantCommand.Name));
        RuleFor(c => c.Plan).IsInEnum();
        RuleFor(c => c.LogoUrl).MaximumLengthWithMessage(MaxLength.C1024, nameof(UpdateTenantCommand.LogoUrl));
        RuleFor(c => c.PrimaryColor).MaximumLengthWithMessage(MaxLength.C16, nameof(UpdateTenantCommand.PrimaryColor));
    }
}
