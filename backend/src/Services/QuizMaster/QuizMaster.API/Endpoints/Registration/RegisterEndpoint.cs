using QuizMaster.Application.Features.Registration.Register;

namespace QuizMaster.API.Endpoints.Registration;

public static class RegisterEndpoint
{
    public static void Map(this IEndpointRouteBuilder app)
    {
        // Anonymous: the person has no account yet. The registration key is the credential.
        app.MapPost("/registrations", async (RegisterCommand command, ISender sender) =>
        {
            var response = await sender.Send(command);
            return Results.Created($"/api/users/{response.UserId}", response);
        })
        .AllowAnonymous()
        .RequireRateLimiting(RateLimits.Registration)
        .WithName("Register")
        .WithTags("Registration")
        .Produces<RegistrationResponse>(StatusCodes.Status201Created)
        .ProducesProblem(StatusCodes.Status400BadRequest)
        .ProducesProblem(StatusCodes.Status429TooManyRequests)
        .ProducesProblem(StatusCodes.Status409Conflict);
    }
}
