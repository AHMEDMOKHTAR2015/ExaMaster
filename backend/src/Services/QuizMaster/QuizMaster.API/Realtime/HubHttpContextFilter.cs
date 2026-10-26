using Microsoft.AspNetCore.SignalR;

namespace QuizMaster.API.Realtime;

// Hub methods that read the database go through the same tenant filter and claims as a request does (HttpContextProvider,
// which reads IHttpContextAccessor). Over WebSockets and Server-Sent Events the connection's own request is still the
// current one; over long polling every poll is a request of its own, and a hub method runs outside all of them. So the
// connection's HttpContext (its user as authenticated when it connected) is made current for the invocation.
public sealed class HubHttpContextFilter(IHttpContextAccessor _httpContextAccessor) : IHubFilter
{
    // async on purpose: the accessor is an AsyncLocal, and an async method gives the change back when it returns, so it
    // never leaks into whatever the connection processes next
    public async ValueTask<object?> InvokeMethodAsync(
        HubInvocationContext invocationContext, Func<HubInvocationContext, ValueTask<object?>> next)
    {
        _httpContextAccessor.HttpContext ??= invocationContext.Context.GetHttpContext();
        return await next(invocationContext);
    }
}
