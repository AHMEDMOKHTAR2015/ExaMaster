namespace QuizMaster.Application.Features.AccessRequests.ListAccessRequests;

public class ListAccessRequestsQueryHandler(QuizMasterDbContext _dbContext)
    : IRequestHandler<ListAccessRequestsQuery, PagedResponse<AccessRequestDto>>
{
    public async Task<PagedResponse<AccessRequestDto>> Handle(ListAccessRequestsQuery query, CancellationToken ct)
    {
        var requests = _dbContext.AccessRequests.AsNoTracking();

        if (query.Status is { } status)
            requests = requests.Where(request => request.Status == status);
        if (query.Kind is { } kind)
            requests = requests.Where(request => request.Kind == kind);
        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var pattern = $"%{query.Search.Trim()}%";
            requests = requests.Where(request => EF.Functions.Like(request.FirstName + " " + request.LastName, pattern)
                || EF.Functions.Like(request.MobileNumber, pattern)
                || EF.Functions.Like(request.SchoolName!, pattern)
                || EF.Functions.Like(request.ParentName!, pattern)
                || EF.Functions.Like(request.ParentMobileNumber!, pattern));
        }

        // pending first and oldest first, so the queue is worked in arrival order; decided ones newest decision first
        var totalCount = await requests.CountAsync(ct);
        var page = await requests
            .OrderByDescending(request => request.Status == AccessRequestStatus.Pending)
            .ThenBy(request => request.Status == AccessRequestStatus.Pending ? request.CreatedOn : DateTime.MaxValue)
            .ThenByDescending(request => request.DecidedOn).ThenByDescending(request => request.Id)
            .Skip((query.Page - 1) * query.PageSize).Take(query.PageSize)
            .ToListAsync(ct);

        var tenantIds = page.Where(request => request.ApprovedTenantId != null).Select(request => request.ApprovedTenantId!.Value).Distinct().ToList();
        var tenantNames = await _dbContext.Tenants.AsNoTracking()
            .Where(tenant => tenantIds.Contains(tenant.Id))
            .ToDictionaryAsync(tenant => tenant.Id, tenant => tenant.Name, ct);

        var items = page.Select(request => new AccessRequestDto(
            request.Id, request.Kind, request.FirstName, request.LastName, request.MobileNumber,
            request.ContactEmail, request.SchoolName, request.GradeName, request.ParentName, request.ParentMobileNumber,
            request.Note, request.Status, request.CreatedOn, request.DecidedOn, request.RejectionReason,
            request.ApprovedTenantId, request.ApprovedTenantId is { } tenantId ? tenantNames.GetValueOrDefault(tenantId) : null,
            request.ApprovedUserId)).ToList();

        return new PagedResponse<AccessRequestDto>(items, query.Page, query.PageSize, totalCount);
    }
}
