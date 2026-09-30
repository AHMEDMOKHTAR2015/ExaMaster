namespace QuizMaster.Application.Features.RegistrationKeys.SearchRegistrationKeys;

public class SearchRegistrationKeysQueryHandler(Repository<RegistrationKey> _keyRepository)
    : IRequestHandler<SearchRegistrationKeysQuery, PagedResponse<RegistrationKeyDto>>
{
    public async Task<PagedResponse<RegistrationKeyDto>> Handle(SearchRegistrationKeysQuery query, CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var keys = _keyRepository.QueryNotTracked();

        if (query.Role is { } role)
            keys = keys.Where(key => key.Role == role);
        if (query.Status is { } status)
            keys = WithStatus(keys, status, now);

        return await keys
            .OrderByDescending(key => key.CreatedOn).ThenByDescending(key => key.Id)
            .ToPageAsync(query, key => RegistrationKeyDto.From(key, now), ct);
    }

    //insight - RegistrationKey.StatusAt written as SQL: filtering on the rule itself means no stored status to sweep as
    // keys expire.
    private static IQueryable<RegistrationKey> WithStatus(IQueryable<RegistrationKey> keys, RegistrationKeyStatus status, DateTime now) => status switch
    {
        RegistrationKeyStatus.Inactive => keys.Where(key => !key.IsActive),
        RegistrationKeyStatus.Expired => keys.Where(key => key.IsActive && key.ExpiresOn != null && key.ExpiresOn <= now),
        RegistrationKeyStatus.Used => keys.Where(key => key.IsActive && (key.ExpiresOn == null || key.ExpiresOn > now)
                                                        && key.Role == UserRoleType.PARENT && key.ParentId != null),
        _ => keys.Where(key => key.IsActive && (key.ExpiresOn == null || key.ExpiresOn > now)
                               && !(key.Role == UserRoleType.PARENT && key.ParentId != null))
    };
}
