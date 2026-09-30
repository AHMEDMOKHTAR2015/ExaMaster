namespace QuizMaster.Application.Features.Shared;

public interface IPagedQuery
{
    int Page { get; }
    int PageSize { get; }
}

public static class Paging
{
    public const int DefaultPageSize = 20;
    public const int MaxPageSize = 100;

    public static void AddPagingRules<TQuery>(this AbstractValidator<TQuery> validator)
        where TQuery : IPagedQuery
    {
        validator.RuleFor(q => q.Page).GreaterThanOrEqualTo(1);
        validator.RuleFor(q => q.PageSize).InclusiveBetween(1, MaxPageSize);
    }

    public static async Task<PagedResponse<TDto>> ToPageAsync<TEntity, TDto>(
        this IQueryable<TEntity> query, IPagedQuery page, Func<TEntity, TDto> map, CancellationToken ct)
    {
        var totalCount = await query.CountAsync(ct);
        var items = await query.Skip((page.Page - 1) * page.PageSize).Take(page.PageSize).ToListAsync(ct);
        return new PagedResponse<TDto>(items.Select(map).ToList(), page.Page, page.PageSize, totalCount);
    }
}
