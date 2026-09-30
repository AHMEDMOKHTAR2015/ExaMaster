using QuizMaster.Application.Features.Platform.CreateTenant;

namespace QuizMaster.API.Endpoints.Platform;

public static class CreateTenantEndpoint
{
    public static void Map(this IEndpointRouteBuilder app)
    {
        app.MapPost("/platform/tenants", async (CreateTenantCommand command, ISender sender) =>
        {
            var response = await sender.Send(command);
            return Results.Created($"/api/platform/tenants/{response.TenantId}", response);
        })
        .RequireRoleAuthorization(Role.PlatformAdmin)
        .WithName("CreateTenant")
        .WithTags("Platform")
        .Produces<CreateTenantResponse>(StatusCodes.Status201Created)
        .ProducesProblem(StatusCodes.Status400BadRequest)
        .ProducesProblem(StatusCodes.Status409Conflict)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden);
    }
}
