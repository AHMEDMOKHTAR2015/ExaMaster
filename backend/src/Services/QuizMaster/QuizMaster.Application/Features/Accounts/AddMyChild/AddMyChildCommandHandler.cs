using QuizMaster.Application.Features.Accounts.Shared;

namespace QuizMaster.Application.Features.Accounts.AddMyChild;

public class AddMyChildCommandHandler(FamilyEnrolment _enrolment, Repository<User> _userRepository, ISignInAccounts _signInAccounts)
    : IRequestHandler<AddMyChildCommand, IdResponse>
{
    public async Task<IdResponse> Handle(AddMyChildCommand command, CancellationToken ct)
    {
        // the caller is the parent: a parent can only ever enrol a child of their own
        var (parent, key, classGroup) = await _enrolment.ChargeSlotAsync(command.CreatedById, command.ClassId, command, ct);
        var email = SignInEmail.ForMobile(command.MobileNumber);

        return await _signInAccounts.CreateThenPersistAsync(
            new NewSignInAccount(email, command.Password, SignInEmail.DisplayName(command.FirstName, command.LastName)),
            async uid =>
            {
                var child = FamilyEnrolment.CreateChild(uid, email, command.FirstName, command.LastName,
                    command.MobileNumber, parent, key, classGroup, command);
                await _userRepository.AddAsync(child, ct);
                await _userRepository.SaveChangesAsync(ct);          // the child and the spent slot, in one commit
                return new IdResponse(child.Id);
            }, ct);
    }
}
