namespace QuizMaster.Application.Features.Users.GetCurrentUser;

public class GetCurrentUserQueryHandler(
    Repository<User> _userRepository, Repository<Tenant> _tenantRepository, Repository<RegistrationKey> _keyRepository, IClaimsProvider _claimsProvider)
    : IRequestHandler<GetCurrentUserQuery, GetCurrentUserResponse>
{
    public async Task<GetCurrentUserResponse> Handle(GetCurrentUserQuery query, CancellationToken ct)
    {
        // Signed in, but never given a profile: the client should show "account not set up".
        var userId = _claimsProvider.TryGetUserId()
            ?? throw new NotFoundException("No QuizMasterPro profile exists for this sign-in.");

        var user = Guard.NotFound(await _userRepository.GetByIdAsync(userId, ct));
        // a platform administrator belongs to no organization
        var tenant = user.TenantId == 0 ? null : Guard.NotFound(await _tenantRepository.GetByIdAsync(user.TenantId, ct));

        var now = DateTime.UtcNow;
        var key = user.RegistrationKeyId is { } keyId ? await _keyRepository.GetByIdAsync(keyId, ct) : null;
        var problem = user.RegistrationKeyId is null ? null : key is null ? RegistrationKeyProblem.Missing : key.AdmissionProblemAt(now);

        return new GetCurrentUserResponse(
            user.Adapt<UserDto>(),
            tenant?.Adapt<TenantDto>(),
            key is null ? null : RegistrationKeyDto.From(key, now),
            problem);
    }
}
