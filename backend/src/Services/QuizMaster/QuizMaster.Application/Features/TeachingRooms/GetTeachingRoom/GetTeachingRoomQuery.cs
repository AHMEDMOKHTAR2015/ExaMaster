namespace QuizMaster.Application.Features.TeachingRooms.GetTeachingRoom;

// A room as its page opens it: what is presented, by whom, and where the caller stands; the teacher also gets the requests.
// Never the board itself: that is GetTeachingRoomState (or the hub's JoinRoom), for the admitted only.
public record GetTeachingRoomQuery(int Id) : IQuery<GetTeachingRoomResponse>;
public record GetTeachingRoomResponse(TeachingRoomDto Room);

public class GetTeachingRoomQueryValidator : AbstractValidator<GetTeachingRoomQuery>
{
    public GetTeachingRoomQueryValidator()
        => RuleFor(q => q.Id).GreaterThan(0).WithMessageForInvalidId(nameof(GetTeachingRoomQuery.Id));
}
