using QuizMaster.Application.Features.Translations.GetTranslationOverrides;

namespace QuizMaster.API.Endpoints.Translations;

public static class GetTranslationOverridesEndpoint
{
    public static void Map(this IEndpointRouteBuilder app)
    {
        // every member: students see their school's wording too
        app.MapGet("/translation-overrides", async (ISender sender) => Results.Ok(await sender.Send(new GetTranslationOverridesQuery())))
        .RequireRoleAuthorization(Role.Member)
        .WithName("GetTranslationOverrides")
        .WithTags("Translations")
        .Produces<TranslationOverridesResponse>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden);
    }
}
