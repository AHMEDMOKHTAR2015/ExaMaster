using Microsoft.Extensions.Logging;
using QuizMaster.Application.Features.TeachingRooms.Shared;
using QuizMaster.Application.Realtime;

namespace QuizMaster.Application.Features.TeachingRooms.RequestToJoinTeachingRoom;

public class RequestToJoinTeachingRoomCommandHandler(
    TeachingRoomRepository _roomRepository, QuizMasterDbContext _dbContext,
    ITeachingRoomBroadcaster _broadcaster, ILogger<RequestToJoinTeachingRoomCommandHandler> _logger)
    : IRequestHandler<RequestToJoinTeachingRoomCommand, RequestToJoinTeachingRoomResponse>
{
    public async Task<RequestToJoinTeachingRoomResponse> Handle(RequestToJoinTeachingRoomCommand command, CancellationToken ct)
    {
        var room = await _roomRepository.GetByIdOrThrowAsync(command.AggregateId, ct);
        var existing = room.MemberFor(command.CreatedById);
        if (existing is not null)
            return new RequestToJoinTeachingRoomResponse(TeachingRoomAdmissions.ForMember(existing.Status));

        if (!await _dbContext.MaterialReachesStudentAsync(room.TeachingMaterialId, command.CreatedById, ct))
            throw new ForbiddenException("This teaching room is for another class.");

        var member = room.RequestToJoin(command.CreatedById, command);
        await _roomRepository.SaveChangesAsync(ct);

        await TeachingRoomSignals.SafelyAsync(_logger, room.Id, () => _broadcaster.JoinRequestsChangedAsync(room.Id, room.CreatedById, ct));
        return new RequestToJoinTeachingRoomResponse(TeachingRoomAdmissions.ForMember(member.Status));
    }
}
