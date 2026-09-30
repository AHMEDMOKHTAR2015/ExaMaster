namespace QuizMaster.Domain.Registration;

// Derived, never stored: see RegistrationKey.StatusAt. Queries filter on the same rule directly
// (RegistrationKeyStatusFilter), so there is nothing to keep in sync and no expiry sweep.
public enum RegistrationKeyStatus
{
    Active = 1,
    Inactive = 2,
    Expired = 3,
    Used = 4,
}

// Why a key no longer admits the accounts that registered with it. The client words it (the app worded it twice: to
// the parent, and to a child whose parent has to renew).
public enum RegistrationKeyProblem
{
    Missing = 1,
    Inactive = 2,
    Expired = 3,
}
