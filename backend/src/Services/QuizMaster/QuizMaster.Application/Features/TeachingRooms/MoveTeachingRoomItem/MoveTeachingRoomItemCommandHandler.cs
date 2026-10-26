using Microsoft.Extensions.Logging;
using QuizMaster.Application.Features.TeachingRooms.Shared;
using QuizMaster.Application.Realtime;

namespace QuizMaster.Application.Features.TeachingRooms.MoveTeachingRoomItem;

public class MoveTeachingRoomItemCommandHandler(
    TeachingRoomRepository _roomRepository, TeachingMaterialRepository _materialRepository,
    ITeachingRoomBroadcaster _broadcaster, ILogger<MoveTeachingRoomItemCommandHandler> _logger)
    : IRequestHandler<MoveTeachingRoomItemCommand, MoveTeachingRoomItemResponse>
{
    public async Task<MoveTeachingRoomItemResponse> Handle(MoveTeachingRoomItemCommand command, CancellationToken ct)
    {
        var room = await _roomRepository.GetByIdOrThrowAsync(command.AggregateId, ct);
        if (command.Move == TeachingRoomMove.Next)
            room.GoToNext(command);
        else
            room.GoToPrevious(command);
        await _roomRepository.SaveChangesAsync(ct);

        // read once, sent to the whole group: no student re-reads anything
        var state = await _materialRepository.StateOfAsync(room, ct);
        await TeachingRoomSignals.SafelyAsync(_logger, room.Id, () => _broadcaster.CurrentItemChangedAsync(state, ct));

        return new MoveTeachingRoomItemResponse(state);
    }
}
