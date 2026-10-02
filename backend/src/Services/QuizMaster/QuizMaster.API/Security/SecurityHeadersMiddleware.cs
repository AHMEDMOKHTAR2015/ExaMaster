namespace QuizMaster.API.Security;

// The browser-side protections every response carries (OWASP Secure Headers): this API serves the Angular app from the
// same origin, so the Content-Security-Policy here is the app's.
//insight - script-src 'self' with no 'unsafe-inline' is what turns an injected <img onerror=…> or <script> into a
// no-op even if one ever got past Angular's sanitizer. Styles keep 'unsafe-inline': Angular inserts component styles as
// <style> elements at runtime, and a style cannot run code.
public class SecurityHeadersMiddleware(RequestDelegate next, IHostEnvironment environment)
{
    private const string OneYear = "31536000";

    public Task InvokeAsync(HttpContext context)
    {
        context.Response.OnStarting(() =>
        {
            var headers = context.Response.Headers;
            headers.XContentTypeOptions = "nosniff";
            headers.XFrameOptions = "DENY";
            headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
            headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=(), payment=(), usb=()";
            headers["Cross-Origin-Opener-Policy"] = "same-origin";

            // Swagger UI (development only) runs inline scripts of its own
            if (!context.Request.Path.StartsWithSegments("/swagger"))
                headers.ContentSecurityPolicy = ContentSecurityPolicy(context.Request.Host.Value);

            // HTTPS is enforced by App Service ("HTTPS Only"); this tells browsers never to try plain HTTP again
            if (!environment.IsDevelopment())
                headers.StrictTransportSecurity = $"max-age={OneYear}; includeSubDomains";

            // API answers hold personal data and answer keys: no browser or proxy may keep a copy
            if (context.Request.Path.StartsWithSegments("/api") && string.IsNullOrEmpty(headers.CacheControl))
                headers.CacheControl = "no-store";

            return Task.CompletedTask;
        });

        return next(context);
    }

    private string ContentSecurityPolicy(string? host)
    {
        var development = environment.IsDevelopment();
        // the live-updates socket: 'self' covers it in current browsers, the explicit origin covers older Safari
        var socket = host is null ? string.Empty : $" {(development ? "ws" : "wss")}://{host}";
        return string.Join("; ",
            "default-src 'self'",
            "script-src 'self'",
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
            "font-src 'self' https://fonts.gstatic.com data:",
            "img-src 'self' data: blob:",
            $"connect-src 'self'{socket}",
            "media-src 'self'",
            "object-src 'none'",
            "base-uri 'self'",
            "form-action 'self'",
            "frame-ancestors 'none'") + (development ? string.Empty : "; upgrade-insecure-requests");
    }
}
