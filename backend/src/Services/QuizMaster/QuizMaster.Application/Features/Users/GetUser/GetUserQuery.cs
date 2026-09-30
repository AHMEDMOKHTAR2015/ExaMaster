namespace QuizMaster.Application.Features.Users.GetUser;

public record GetUserQuery(int Id) : IQuery<GetUserResponse>;
public record GetUserResponse(UserDto User);

public class GetUserQueryValidator : AbstractValidator<GetUserQuery>
{
    public GetUserQueryValidator()
        => RuleFor(q => q.Id).GreaterThan(0).WithMessageForInvalidId(nameof(GetUserQuery.Id));
}
