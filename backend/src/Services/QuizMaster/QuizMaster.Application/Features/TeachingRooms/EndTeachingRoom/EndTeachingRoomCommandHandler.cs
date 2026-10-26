using Microsoft.Extensions.Logging;
using QuizMaster.Application.Realtime;

namespace QuizMaster.Application.Features.TeachingRooms.EndTeachingRoom;

public class EndTeachingRoomCommandHandler(
    TeachingRoomRepository _roomRepository, ITeachingRoomBroadcaster _broadcaster, ILogger<EndTeachingRoomCommandHandler> _logger)
    : IRequestHandler<EndTeachingRoomCommand, IdResponse>
{
    public async Task<IdResponse> Handle(EndTeachingRoomCommand command, CancellationToken ct)
    {
        var room = await _roomRepository.GetByIdOrThrowAsync(command.AggregateId, ct);
        if (!room.IsPresentedBy(command.CreatedById))
            throw new ForbiddenException("Only the teacher presenting this room can end it.");

        _roomRepository.Remove(room);
        await _roomRepository.SaveChangesAsync(ct);

        await TeachingRoomSignals.SafelyAsync(_logger, room.Id, () => _broadcaster.EndedAsync(room.Id, ct));
        return new IdResponse(room.Id);
    }
}
