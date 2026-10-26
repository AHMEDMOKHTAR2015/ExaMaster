using QuizMaster.Application.Features.TeachingRooms.Shared;

namespace QuizMaster.Application.Features.TeachingRooms.GetTeachingRoomState;

public class GetTeachingRoomStateQueryHandler(
    QuizMasterDbContext _dbContext, TeachingMaterialRepository _materialRepository, IClaimsProvider _claimsProvider)
    : IRequestHandler<GetTeachingRoomStateQuery, GetTeachingRoomStateResponse>
{
    public async Task<GetTeachingRoomStateResponse> Handle(GetTeachingRoomStateQuery query, CancellationToken ct)
    {
        var caller = Caller.From(_claimsProvider);
        var admission = await _dbContext.AdmissionAsync(query.Id, caller.UserId, caller.Roles, ct);
        if (!admission.IsAdmitted())
            throw new ForbiddenException("Only the teacher and the students they let in can see this room's board.");

        var room = await _dbContext.TeachingRooms.AsNoTracking().SingleOrThrowAsync(room => room.Id == query.Id, ct);

        return new GetTeachingRoomStateResponse(await _materialRepository.StateOfAsync(room, ct));
    }
}
