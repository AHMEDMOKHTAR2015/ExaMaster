using System.Net;

namespace QuizMaster.API.Security;

// The address a request really came from: what per-address rate limits count.
//insight - in production the API runs behind Azure App Service's front end, which APPENDS the caller's address to
// X-Forwarded-For (as "address:port"). Only that last entry can be trusted: anything before it is whatever the caller
// chose to send. Without a proxy in front (development) the connection's own address is the caller.
public static class ClientAddress
{
    public static string Of(HttpContext context, bool behindProxy)
    {
        if (behindProxy && context.Request.Headers["X-Forwarded-For"].ToString() is { Length: > 0 } forwarded
            && Parse(forwarded[(forwarded.LastIndexOf(',') + 1)..].Trim()) is { } address)
            return address.ToString();

        return context.Connection.RemoteIpAddress?.ToString() ?? "unknown";
    }

    private static IPAddress? Parse(string value)
        => IPEndPoint.TryParse(value, out var endPoint) ? endPoint.Address
            : IPAddress.TryParse(value, out var address) ? address
            : null;
}
