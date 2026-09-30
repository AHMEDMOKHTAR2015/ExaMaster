using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.Tokens;

// Development-only tokens, so the API can be called without signing in with a password.
// A dev token carries only WHO the caller is: "sub" is an account uid. Roles and tenant are NOT in the token;
// the API loads them from its database, exactly as it does for a token issued at sign-in.
//
// The demo school seed (opt-in: SeedOptions__DemoSchool=true) creates these accounts (tenant "demo-school"):
//   dev-admin (APPLICATION_ADMIN) · dev-teacher (TEACHER) · dev-parent (PARENT) · dev-student (STUDENT) · dev-student-2 (STUDENT)
// and, belonging to no tenant: dev-platform (PLATFORM_ADMIN)
//
//   dotnet run --project tools/QuizMasterPro.DevToken -- --uid dev-student
//   dotnet run --project tools/QuizMasterPro.DevToken -- --uid dev-teacher --minutes 240
//
// Defaults match DevTokenOptions in src/Services/QuizMaster/QuizMaster.API/appsettings.Development.json.

var options = ParseArgs(args);
var uid     = options.GetValueOrDefault("uid", "dev-student");
var name    = options.GetValueOrDefault("name", uid);
var email   = options.GetValueOrDefault("email", $"{uid}@quizmasterpro.local");
var issuer  = options.GetValueOrDefault("issuer", "QuizMasterPro.DevToken");
var secret  = options.GetValueOrDefault("secret", "local-development-signing-key-change-me-0123456789");
var minutes = int.Parse(options.GetValueOrDefault("minutes", "60"));

var claims = new List<Claim>
{
    new(JwtRegisteredClaimNames.Sub, uid),
    new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
    new("name", name),
    new(JwtRegisteredClaimNames.Email, email),
};

var credentials = new SigningCredentials(new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret)), SecurityAlgorithms.HmacSha256);
var token = new JwtSecurityToken(issuer, issuer, claims, DateTime.UtcNow, DateTime.UtcNow.AddMinutes(minutes), credentials);

Console.WriteLine(new JwtSecurityTokenHandler().WriteToken(token));

static Dictionary<string, string> ParseArgs(string[] args)
{
    var result = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
    for (var i = 0; i < args.Length - 1; i++)
        if (args[i].StartsWith("--"))
            result[args[i][2..]] = args[++i];
    return result;
}
