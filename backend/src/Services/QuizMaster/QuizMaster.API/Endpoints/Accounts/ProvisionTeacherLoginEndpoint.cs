using QuizMaster.Application.Features.Accounts.ProvisionTeacherLogin;

namespace QuizMaster.API.Endpoints.Accounts;

public static class ProvisionTeacherLoginEndpoint
{
    public static void Map(this IEndpointRouteBuilder app)
    {
        app.MapPost("/teachers/{id:int}/login", async (int id, ProvisionTeacherLoginCommand command, ISender sender)
            => Results.Ok(await sender.Send(command with { AggregateId = id })))
        .RequireRoleAuthorization(Role.ApplicationAdmin)
        .WithName("ProvisionTeacherLogin")
        .WithTags("Teachers")
        .Produces<TeacherLoginResponse>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status400BadRequest)
        .ProducesProblem(StatusCodes.Status404NotFound)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden);
    }
}
