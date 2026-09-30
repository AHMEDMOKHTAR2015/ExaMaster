namespace QuizMaster.Application.Features.Users.GetMyChildren;

// A parent's children: the accounts that name the caller as their parent.
public record GetMyChildrenQuery : IQuery<GetMyChildrenResponse>;
public record GetMyChildrenResponse(IReadOnlyList<UserDto> Children);
