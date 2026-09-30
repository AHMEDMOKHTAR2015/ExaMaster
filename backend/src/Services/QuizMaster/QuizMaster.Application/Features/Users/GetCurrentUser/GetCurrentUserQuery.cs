namespace QuizMaster.Application.Features.Users.GetCurrentUser;

// The signed-in person's own profile and organization (none for a platform administrator): the first call a client makes after signing in.
// RegistrationKeyProblem set = the key this account registered with has lapsed, and the account holds no roles until it
// is renewed; the client should say why and sign out (the app's admitCurrentUser).
public record GetCurrentUserQuery : IQuery<GetCurrentUserResponse>;
public record GetCurrentUserResponse(UserDto User, TenantDto? Tenant, RegistrationKeyDto? RegistrationKey, RegistrationKeyProblem? RegistrationKeyProblem);
