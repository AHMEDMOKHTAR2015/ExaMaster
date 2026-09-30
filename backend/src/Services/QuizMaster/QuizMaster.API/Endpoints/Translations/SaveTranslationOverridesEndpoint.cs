using QuizMaster.Application.Features.Translations.SaveTranslationOverrides;

namespace QuizMaster.API.Endpoints.Translations;

public static class SaveTranslationOverridesEndpoint
{
    public static void Map(this IEndpointRouteBuilder app)
    {
        app.MapPut("/translation-overrides/{language}", async (string language, SaveTranslationOverridesCommand command, ISender sender)
            => Results.Ok(await sender.Send(command with { Language = language })))
        .RequireRoleAuthorization(Role.ApplicationAdmin)
        .WithName("SaveTranslationOverrides")
        .WithTags("Translations")
        .Produces<SaveTranslationOverridesResponse>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status400BadRequest)
        .ProducesProblem(StatusCodes.Status409Conflict)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden);
    }
}
