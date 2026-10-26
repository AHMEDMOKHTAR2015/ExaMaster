namespace QuizMaster.Application.Features.TeachingRooms.GetTeachingRoomState;

// The board: the item the teacher is on. Only the presenting teacher and the students they approved read it; a waiting,
// turned-away or removed student gets nothing of it.
public record GetTeachingRoomStateQuery(int Id) : IQuery<GetTeachingRoomStateResponse>;
public record GetTeachingRoomStateResponse(TeachingRoomStateDto State);

public class GetTeachingRoomStateQueryValidator : AbstractValidator<GetTeachingRoomStateQuery>
{
    public GetTeachingRoomStateQueryValidator()
        => RuleFor(q => q.Id).GreaterThan(0).WithMessageForInvalidId(nameof(GetTeachingRoomStateQuery.Id));
}
