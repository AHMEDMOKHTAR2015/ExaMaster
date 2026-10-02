namespace QuizMaster.API;

// The built Angular app, served from this API's own origin: the deploy workflow copies client/dist/ng6-quiz into
// wwwroot. In development there is no wwwroot (the app runs on ng serve), so nothing here matches anything.
public static class ClientAppHosting
{
    // Only the esbuild output is content-hashed; everything else keeps a stable name and must be revalidated.
    private static readonly StaticFileOptions ClientAppFiles = new()
    {
        OnPrepareResponse = context =>
        {
            var path = context.Context.Request.Path.Value ?? string.Empty;
            context.Context.Response.Headers.CacheControl =
                path.EndsWith("/index.html", StringComparison.OrdinalIgnoreCase) ? "no-cache, no-store"
                : IsContentHashed(path) ? "public, max-age=31536000, immutable"
                : "no-cache";
        }
    };

    public static IApplicationBuilder UseClientAppFiles(this IApplicationBuilder app) =>
        app.UseDefaultFiles().UseStaticFiles(ClientAppFiles);

    // Any other path is a client-side route and gets index.html, except under /api and /hubs, where a miss is a 404.
    public static IEndpointRouteBuilder MapClientApp(this IEndpointRouteBuilder app)
    {
        // public: the sign-in page is part of the app, and an unknown /api path is a 404 for anyone
        app.MapFallbackToFile("index.html", ClientAppFiles).AllowAnonymous();
        app.MapFallback("/api/{**path}", () => Results.NotFound()).AllowAnonymous();
        app.MapFallback("/hubs/{**path}", () => Results.NotFound()).AllowAnonymous();
        // a file that is not there (a stale asset link) is a 404, not the sign-in challenge deny-by-default would give it
        app.MapFallback("{**path:file}", () => Results.NotFound()).AllowAnonymous();
        return app;
    }

    private static bool IsContentHashed(string path) =>
        path.StartsWith("/media/", StringComparison.OrdinalIgnoreCase)
        || (path.LastIndexOf('/') == 0
            && (path.EndsWith(".js", StringComparison.OrdinalIgnoreCase) || path.EndsWith(".css", StringComparison.OrdinalIgnoreCase)));
}
