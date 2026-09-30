using System.ComponentModel.DataAnnotations;

namespace QuizMaster.API;

// The browser origins allowed to call this API (the Angular app: its dev server and wherever it is hosted).
public record ClientAppOptions
{
    [Required, MinLength(1)]
    public required string[] AllowedOrigins { get; init; }
}
