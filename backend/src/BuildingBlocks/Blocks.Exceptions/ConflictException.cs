using System.Net;

namespace Blocks.Exceptions;

public class ConflictException : HttpException
{
    public ConflictException(string exceptionMessage) : base(HttpStatusCode.Conflict, exceptionMessage) { }
}
