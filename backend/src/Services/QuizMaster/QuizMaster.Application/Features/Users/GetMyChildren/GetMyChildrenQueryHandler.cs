namespace QuizMaster.Application.Features.Users.GetMyChildren;

public class GetMyChildrenQueryHandler(Repository<User> _userRepository, QuizMasterDbContext _dbContext, IClaimsProvider _claimsProvider)
    : IRequestHandler<GetMyChildrenQuery, GetMyChildrenResponse>
{
    public async Task<GetMyChildrenResponse> Handle(GetMyChildrenQuery query, CancellationToken ct)
    {
        var parentId = _claimsProvider.GetUserId();

        var children = await _userRepository.QueryNotTracked()
            .Where(user => user.ParentId == parentId)
            .OrderBy(user => user.DisplayName)
            .ToListAsync(ct);

        // How many attempts each child has submitted, in one grouped query: the parent's dashboard and My Children
        // show it, and UserDto leaves it empty unless the handler fills it (as the users list does).
        var ids = children.Select(child => child.Id).ToList();
        var participationCounts = await _dbContext.Participations.AsNoTracking()
            .Where(participation => ids.Contains(participation.ChildId))
            .GroupBy(participation => participation.ChildId)
            .Select(group => new { ChildId = group.Key, Count = group.Count() })
            .ToDictionaryAsync(entry => entry.ChildId, entry => entry.Count, ct);

        return new GetMyChildrenResponse(children
            .Select(child => child.Adapt<UserDto>() with { ParticipationCount = participationCounts.GetValueOrDefault(child.Id) })
            .ToList());
    }
}
