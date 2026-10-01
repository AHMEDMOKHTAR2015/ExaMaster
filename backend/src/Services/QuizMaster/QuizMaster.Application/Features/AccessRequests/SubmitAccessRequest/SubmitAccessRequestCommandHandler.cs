using QuizMaster.Application.Features.Accounts.Shared;
using QuizMaster.Application.Features.Registration.Shared;

namespace QuizMaster.Application.Features.AccessRequests.SubmitAccessRequest;

public class SubmitAccessRequestCommandHandler(Repository<AccessRequest> _requestRepository, ISignInAccounts _signInAccounts, IClaimsProvider _claimsProvider)
    : IRequestHandler<SubmitAccessRequestCommand, IdResponse>
{
    public async Task<IdResponse> Handle(SubmitAccessRequestCommand command, CancellationToken ct)
    {
        RegistrationGuards.EnsureCallerHasNoAccount(_claimsProvider);

        // Families sign in with their mobile number, platform-wide: one already in use belongs to somebody.
        var signInEmail = SignInEmail.ForMobile(command.MobileNumber);
        if (await _signInAccounts.FindUidByEmailAsync(signInEmail, ct) is not null)
            throw new ConflictException("An account with this mobile number already exists. Sign in instead, or ask whoever manages it to set a new password.");
        if (await _requestRepository.ExistsAsync(request => request.SignInEmail == signInEmail && request.Status == AccessRequestStatus.Pending, ct))
            throw new ConflictException("A request for this mobile number is already waiting for approval.");

        var hints = new AccessRequestHints(command.SchoolName, command.Email, command.GradeName, command.ParentName, command.ParentMobileNumber, command.Note);

        var request = AccessRequest.Submit(command.Kind, command.FirstName, command.LastName, command.MobileNumber, signInEmail,
            _signInAccounts.HashPassword(command.Password), hints, command);

        await _requestRepository.AddAsync(request, ct);
        await _requestRepository.SaveChangesAsync(ct);          // the filtered unique index settles two submissions at once
        return new IdResponse(request.Id);
    }
}
