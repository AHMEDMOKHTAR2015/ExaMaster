using QuizMaster.Application.Features.Translations.ResetTranslationOverrides;

namespace QuizMaster.API.Endpoints.Translations;

public static class ResetTranslationOverridesEndpoint
{
    public static void Map(this IEndpointRouteBuilder app)
    {
        app.MapDelete("/translation-overrides/{language}", async (string language, ISender sender)
            => Results.Ok(await sender.Send(new ResetTranslationOverridesCommand { Language = language })))
        .RequireRoleAuthorization(Role.ApplicationAdmin)
        .WithName("ResetTranslationOverrides")
        .WithTags("Translations")
        .Produces<ResetTranslationOverridesResponse>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status400BadRequest)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden);
    }
}
