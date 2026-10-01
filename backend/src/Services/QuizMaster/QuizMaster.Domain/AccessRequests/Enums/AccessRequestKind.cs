namespace QuizMaster.Domain.AccessRequests;

// Who is asking to join. Teachers and administrators are always created by their school, never requested.
public enum AccessRequestKind
{
    Parent = 1,
    Child = 2,
}
