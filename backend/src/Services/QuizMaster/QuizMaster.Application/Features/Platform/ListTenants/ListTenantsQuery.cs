namespace QuizMaster.Application.Features.Platform.ListTenants;

// Every organization: the vendor's customer list. Metadata only; no platform endpoint reads data inside a tenant.
public record ListTenantsQuery(
    string? Search = null,
    bool? IsActive = null,
    int Page = 1,
    int PageSize = Paging.DefaultPageSize) : IQuery<PagedResponse<TenantDto>>, IPagedQuery;

public class ListTenantsQueryValidator : AbstractValidator<ListTenantsQuery>
{
    public ListTenantsQueryValidator()
    {
        this.AddPagingRules();
        RuleFor(q => q.Search).MaximumLengthWithMessage(MaxLength.C128, nameof(ListTenantsQuery.Search));
    }
}
