using QuizMaster.Application.Features.RegistrationKeys.SearchRegistrationKeys;

namespace QuizMaster.API.Endpoints.RegistrationKeys;

public static class SearchRegistrationKeysEndpoint
{
    public static void Map(this IEndpointRouteBuilder app)
    {
        app.MapGet("/registration-keys", async ([AsParameters] SearchRegistrationKeysQuery query, ISender sender) => Results.Ok(await sender.Send(query)))
        .RequireRoleAuthorization(Role.ApplicationAdmin)
        .WithName("SearchRegistrationKeys")
        .WithTags("Registration keys")
        .Produces<PagedResponse<RegistrationKeyDto>>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status400BadRequest)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden);
    }
}
