using QuizMaster.Application.Features.Registration.RegisterChild;

namespace QuizMaster.API.Endpoints.Registration;

public static class RegisterChildEndpoint
{
    public static void Map(this IEndpointRouteBuilder app)
    {
        // Anonymous: a child registering with their parent's key.
        app.MapPost("/registrations/child", async (RegisterChildCommand command, ISender sender) =>
        {
            var response = await sender.Send(command);
            return Results.Created($"/api/users/{response.UserId}", response);
        })
        .AllowAnonymous()
        .WithName("RegisterChild")
        .WithTags("Registration")
        .Produces<RegistrationResponse>(StatusCodes.Status201Created)
        .ProducesProblem(StatusCodes.Status400BadRequest)
        .ProducesProblem(StatusCodes.Status409Conflict);
    }
}
