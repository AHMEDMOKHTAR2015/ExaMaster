using QuizMaster.Application.Features.Accounts.Shared;
using QuizMaster.Application.Features.Registration.Shared;

namespace QuizMaster.Application.Features.Registration.Register;

public class RegisterCommandHandler(RegistrationScope _scope, ISignInAccounts _signInAccounts, IClaimsProvider _claimsProvider)
    : IRequestHandler<RegisterCommand, RegistrationResponse>
{
    public async Task<RegistrationResponse> Handle(RegisterCommand command, CancellationToken ct)
    {
        RegistrationGuards.EnsureCallerHasNoAccount(_claimsProvider);

        var key = await _scope.FindKeyAsync(command.Code, ct);
        key.EnsureOpenForRegistration(command.CreatedOn);
        await RegistrationGuards.EnsureOrganizationIsActiveAsync(_scope, key, ct);

        var email = SignInEmail.ForMobile(command.MobileNumber);
        var displayName = SignInEmail.DisplayName(command.FirstName, command.LastName);

        // checked before the sign-in exists, so a key that cannot be used never leaves a login behind
        return await _signInAccounts.CreateThenPersistAsync(new NewSignInAccount(email, command.Password, displayName), async uid =>
            await _scope.InTransactionAsync(async () =>
            {
                var user = User.Create(key.TenantId, uid, email, displayName, [key.Role], command,
                    command.FirstName, command.LastName, command.MobileNumber);
                _scope.Add(user);
                await _scope.SaveChangesAsync(ct);                   // the key is claimed by the new user's id

                user.HoldRegistrationKey(key, command);
                if (key.IsParentKey)
                    key.ClaimFor(user, command);
                await _scope.SaveChangesAsync(ct);

                return new RegistrationResponse(user.Id, email);
            }, ct), ct);
    }
}
