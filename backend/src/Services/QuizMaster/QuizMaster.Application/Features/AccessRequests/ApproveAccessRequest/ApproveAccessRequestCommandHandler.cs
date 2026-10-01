using QuizMaster.Application.Features.AccessRequests.Shared;
using QuizMaster.Application.Features.Accounts.Shared;

namespace QuizMaster.Application.Features.AccessRequests.ApproveAccessRequest;

public class ApproveAccessRequestCommandHandler(Repository<AccessRequest> _requestRepository, AccessRequestScope _scope, ISignInAccounts _signInAccounts)
    : IRequestHandler<ApproveAccessRequestCommand, IdResponse>
{
    public async Task<IdResponse> Handle(ApproveAccessRequestCommand command, CancellationToken ct)
    {
        var request = await _requestRepository.GetByIdOrThrowAsync(command.AggregateId, ct);
        request.EnsurePending();
        var tenant = await _scope.FindActiveTenantAsync(command.TenantId, ct);

        // every check runs before the sign-in exists, so a refused approval never leaves a login behind. Nothing is
        // changed until the transaction: creating the sign-in saves whatever this context tracks, so a change made
        // before it would be committed even if the approval then failed.
        var approval = request.Kind == AccessRequestKind.Child
            ? await PrepareChildAsync(request, tenant, command, ct)
            : PrepareParent(command);

        var displayName = SignInEmail.DisplayName(request.FirstName, request.LastName);
        var account = NewSignInAccount.WithPasswordHash(request.SignInEmail, request.PasswordHash, displayName);

        var userId = await _signInAccounts.CreateThenPersistAsync(account, async uid =>
            await _scope.InTransactionAsync(async () =>
            {
                // the caller (the vendor) has no tenant, so the row names its organization explicitly
                var user = User.Create(tenant.Id, uid, request.SignInEmail, displayName, [approval.Role], command,
                    request.FirstName, request.LastName, request.MobileNumber);
                _scope.Add(user);
                await _scope.SaveChangesAsync(ct);                   // a parent's key and the decision name the new id

                await approval.CompleteAsync(user);
                request.Approve(tenant.Id, user.Id, command);
                await _scope.SaveChangesAsync(ct);                   // its key or slot and placement, and the decision
                return user.Id;
            }, ct), ct);

        return new IdResponse(userId);
    }

    private Approval PrepareParent(ApproveAccessRequestCommand command)
    {
        if (command.ClassId is not null || command.ParentId is not null)
            throw new BadRequestException("A parent is not placed in a class or linked to a parent.");

        return new Approval(UserRoleType.PARENT, async parent =>
        {
                // the key is claimed by the new parent's id, saved just before (inside the same transaction)
            var key = RegistrationKey.Create(UserRoleType.PARENT, expiresOn: null, command.MaxChildren, command);
            key.TenantId = parent.TenantId;
            _scope.Add(key);
            await _scope.SaveChangesAsync(CancellationToken.None);

            parent.HoldRegistrationKey(key, command);
            key.ClaimFor(parent, command);
        });
    }

    private async Task<Approval> PrepareChildAsync(AccessRequest request, Tenant tenant, ApproveAccessRequestCommand command, CancellationToken ct)
    {
        if (command.ParentId is not { } parentId)
            throw new BadRequestException($"Choose the parent {request.FirstName} belongs to.");
        if (command.ClassId is not { } classId)
            throw new BadRequestException($"Choose the class {request.FirstName} studies in.");
        if (command.MaxChildren is not null)
            throw new BadRequestException("A child has no children allowance.");

        var classGroup = await _scope.FindClassAsync(tenant.Id, classId, ct);
        var (parent, key) = await _scope.FindParentWithKeyAsync(tenant.Id, parentId, ct);

        // a full or lapsed key refuses before any login exists; the slot itself is spent with the child
        key.EnsureChildSlotAvailable(parent.Id, command.CreatedOn);

        return new Approval(UserRoleType.STUDENT, child =>
        {
            key.SpendChildSlot(parent.Id, command.CreatedOn, command);
            child.PlaceInClass(classGroup, command);
            child.LinkToParent(parent, command);
            child.HoldRegistrationKey(key, command);
            return Task.CompletedTask;
        });
    }

    // The role the account is created with, and what finishes it once it exists (a parent's key, a child's placement).
    private sealed record Approval(UserRoleType Role, Func<User, Task> CompleteAsync);
}
