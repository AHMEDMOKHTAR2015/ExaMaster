namespace QuizMaster.Application.Features.Users.GetMyChildren;

public class GetMyChildrenQueryHandler(Repository<User> _userRepository, IClaimsProvider _claimsProvider)
    : IRequestHandler<GetMyChildrenQuery, GetMyChildrenResponse>
{
    public async Task<GetMyChildrenResponse> Handle(GetMyChildrenQuery query, CancellationToken ct)
    {
        var parentId = _claimsProvider.GetUserId();

        var children = await _userRepository.QueryNotTracked()
            .Where(user => user.ParentId == parentId)
            .OrderBy(user => user.DisplayName)
            .ToListAsync(ct);

        return new GetMyChildrenResponse(children.Adapt<List<UserDto>>());
    }
}
