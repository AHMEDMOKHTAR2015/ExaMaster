using System.Net;

namespace Blocks.Exceptions;

public class ForbiddenException : HttpException
{
    public ForbiddenException(string exceptionMessage) : base(HttpStatusCode.Forbidden, exceptionMessage) { }
}
