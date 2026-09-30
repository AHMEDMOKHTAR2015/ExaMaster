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
        app.MapFallbackToFile("index.html", ClientAppFiles);
        app.MapFallback("/api/{**path}", () => Results.NotFound());
        app.MapFallback("/hubs/{**path}", () => Results.NotFound());
        return app;
    }

    private static bool IsContentHashed(string path) =>
        path.StartsWith("/media/", StringComparison.OrdinalIgnoreCase)
        || (path.LastIndexOf('/') == 0
            && (path.EndsWith(".js", StringComparison.OrdinalIgnoreCase) || path.EndsWith(".css", StringComparison.OrdinalIgnoreCase)));
}
