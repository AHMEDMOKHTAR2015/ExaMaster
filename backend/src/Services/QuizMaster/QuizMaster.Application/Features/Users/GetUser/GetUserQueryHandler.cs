namespace QuizMaster.Application.Features.Users.GetUser;

public class GetUserQueryHandler(Repository<User> _userRepository)
    : IRequestHandler<GetUserQuery, GetUserResponse>
{
    public async Task<GetUserResponse> Handle(GetUserQuery query, CancellationToken ct)
    {
        var user = Guard.NotFound(await _userRepository.GetByIdAsync(query.Id, ct));

        return new GetUserResponse(user.Adapt<UserDto>());
    }
}
