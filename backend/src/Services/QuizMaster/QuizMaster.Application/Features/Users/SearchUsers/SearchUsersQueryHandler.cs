using QuizMaster.Application.Features.Users.Shared;

namespace QuizMaster.Application.Features.Users.SearchUsers;

public class SearchUsersQueryHandler(Repository<User> _userRepository, QuizMasterDbContext _dbContext)
    : IRequestHandler<SearchUsersQuery, PagedResponse<UserDto>>
{
    public async Task<PagedResponse<UserDto>> Handle(SearchUsersQuery query, CancellationToken ct)
    {
        var users = _userRepository.QueryNotTracked();

        if (query.Role is { } role)
            users = users.Where(user => user.Roles.Contains(role));
        if (query.ClassId is { } classId)
            users = users.Where(user => user.ClassId == classId);
        if (query.ParentId is { } parentId)
            users = users.Where(user => user.ParentId == parentId);
        if (query.IsActive is { } isActive)
            users = users.Where(user => user.IsActive == isActive);
        if (query.Activity is { } activity)
            users = users.WithActivity(activity, DateTime.UtcNow);
        if (query.Participated)
            users = users.Where(user => _dbContext.Participations.Any(participation => participation.ChildId == user.Id));
        users = users.MatchingSearch(query.Search);

        var ordered = query.Participated
            ? users.OrderByDescending(user => _dbContext.Participations.Count(participation => participation.ChildId == user.Id)).ThenBy(user => user.Id)
            : users.OrderBy(user => user.DisplayName).ThenBy(user => user.Id);
        var page = await ordered.ToPageAsync(query, user => user.Adapt<UserDto>(), ct);

        // How many children link to each account on this page, in one grouped query: the parents list shows it,
        // and the app used to read it off a childIds array it had to keep in step by hand.
        var ids = page.Items.Select(user => user.Id).ToList();
        var childCounts = await _userRepository.QueryNotTracked()
            .Where(child => child.ParentId != null && ids.Contains(child.ParentId.Value))
            .GroupBy(child => child.ParentId!.Value)
            .Select(group => new { ParentId = group.Key, Count = group.Count() })
            .ToDictionaryAsync(entry => entry.ParentId, entry => entry.Count, ct);

        // And how many attempts each has submitted: the participations history ranks students by it.
        var participationCounts = await _dbContext.Participations.AsNoTracking()
            .Where(participation => ids.Contains(participation.ChildId))
            .GroupBy(participation => participation.ChildId)
            .Select(group => new { ChildId = group.Key, Count = group.Count() })
            .ToDictionaryAsync(entry => entry.ChildId, entry => entry.Count, ct);

        return page with
        {
            Items = page.Items.Select(user => user with
            {
                ChildCount = childCounts.GetValueOrDefault(user.Id),
                ParticipationCount = participationCounts.GetValueOrDefault(user.Id)
            }).ToList()
        };
    }
}
