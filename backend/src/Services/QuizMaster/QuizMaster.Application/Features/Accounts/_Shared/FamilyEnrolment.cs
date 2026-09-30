namespace QuizMaster.Application.Features.Accounts.Shared;

// Enrolling a child on their family's subscription, whoever does it (the parent, or an administrator on their behalf).
//insight - the slot is always charged to the key the PARENT holds, never to a key named in the request: the app's
// rules charged "that family's key, never an unrelated one", and letting the caller choose would let one family
// spend another's allowance
public class FamilyEnrolment(Repository<User> _userRepository, Repository<RegistrationKey> _keyRepository, Repository<ClassGroup> _classRepository)
{
    // Checked and charged in memory; the caller saves the child and the key together.
    public async Task<(User Parent, RegistrationKey Key, ClassGroup Class)> ChargeSlotAsync(int parentId, int classId, IQuizMasterAction action, CancellationToken ct)
    {
        var parent = await _userRepository.LoadOrThrowAsync(parentId, ct);
        if (!parent.IsParent)
            throw new BadRequestException($"User {parentId} is not a parent account.");

        var key = parent.RegistrationKeyId is { } keyId
            ? await _keyRepository.LoadOrThrowAsync(keyId, ct)
            : throw new BadRequestException("That parent has no registration key, so there is no subscription to enrol the child on.");

        var classGroup = await _classRepository.LoadOrThrowAsync(classId, ct);

        key.SpendChildSlot(parent.Id, action.CreatedOn, action);
        return (parent, key, classGroup);
    }

    public static User CreateChild(string uid, string email, string firstName, string lastName, string mobileNumber,
        User parent, RegistrationKey key, ClassGroup classGroup, IQuizMasterAction action)
    {
        // the parent was loaded through the tenant filter, so theirs is the caller's organization
        var child = User.Create(parent.TenantId, uid, email, SignInEmail.DisplayName(firstName, lastName), [UserRoleType.STUDENT], action,
            firstName, lastName, mobileNumber);
        child.PlaceInClass(classGroup, action);
        child.LinkToParent(parent, action);
        child.HoldRegistrationKey(key, action);
        return child;
    }
}
