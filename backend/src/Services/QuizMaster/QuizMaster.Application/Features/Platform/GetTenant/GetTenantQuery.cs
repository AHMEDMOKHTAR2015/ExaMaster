namespace QuizMaster.Application.Features.Platform.GetTenant;

public record GetTenantQuery(int Id) : IQuery<TenantDto>;
