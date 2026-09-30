using QuizMaster.Application.Features.Accounts.Shared;
using QuizMaster.Application.Features.Registration.Shared;

namespace QuizMaster.Application.Features.Registration.RegisterChild;

public class RegisterChildCommandHandler(RegistrationScope _scope, ISignInAccounts _signInAccounts, IClaimsProvider _claimsProvider)
    : IRequestHandler<RegisterChildCommand, RegistrationResponse>
{
    public async Task<RegistrationResponse> Handle(RegisterChildCommand command, CancellationToken ct)
    {
        RegistrationGuards.EnsureCallerHasNoAccount(_claimsProvider);

        var key = await _scope.FindKeyAsync(command.Code, ct);
        var parent = await _scope.FindKeyOwnerAsync(key, ct);
        var classGroup = await _scope.FindClassAsync(key, command.ClassId, ct);
        await RegistrationGuards.EnsureOrganizationIsActiveAsync(_scope, key, ct);

        // spent before the sign-in exists (in memory; saved below), so a full or lapsed key never leaves a login behind
        key.SpendChildSlot(parent.Id, command.CreatedOn, command);

        var email = SignInEmail.ForMobile(command.MobileNumber);
        var displayName = SignInEmail.DisplayName(command.FirstName, command.LastName);

        return await _signInAccounts.CreateThenPersistAsync(new NewSignInAccount(email, command.Password, displayName), async uid =>
        {
            var child = User.Create(key.TenantId, uid, email, displayName, [UserRoleType.STUDENT], command,
                command.FirstName, command.LastName, command.MobileNumber);
            child.PlaceInClass(classGroup, command);
            child.LinkToParent(parent, command);
            child.HoldRegistrationKey(key, command);

            _scope.Add(child);
            await _scope.SaveChangesAsync(ct);                       // the child and the spent slot, in one commit

            return new RegistrationResponse(child.Id, email);
        }, ct);
    }
}
