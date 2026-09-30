namespace QuizMaster.Domain.Registration;

// What lets a person create their own account in an organization: a family's subscription (PARENT) or an invitation
// to administer the school (APPLICATION_ADMIN). A PARENT key is claimed by the first parent who registers with it and
// then pays for that family's children, up to MaxChildren.
//insight - the key is also the only thing that says which organization a self-registering person joins: they have no
// tenant yet, so the tenant is read from the key and never from the form.
public partial class RegistrationKey : AggregateRoot, IMultitenancy
{
    private RegistrationKey() {}                                 // use RegistrationKey.Create(...)

    public int TenantId { get; set; }

    // What the person types. Unguessable and unique platform-wide: it is looked up before the caller has a tenant.
    public required string Code { get; init; }

    public UserRoleType Role { get; private set; }               // PARENT or APPLICATION_ADMIN
    public bool IsActive { get; private set; }
    public DateTime? ExpiresOn { get; private set; }             // null = never expires

    // PARENT keys only: the family that claimed it, and the children it has paid for.
    public int? ParentId { get; private set; }
    public DateTime? ClaimedOn { get; private set; }
    public int? MaxChildren { get; private set; }                // null = unlimited
    public int ChildCount { get; private set; }

    public bool IsParentKey => Role == UserRoleType.PARENT;
}
