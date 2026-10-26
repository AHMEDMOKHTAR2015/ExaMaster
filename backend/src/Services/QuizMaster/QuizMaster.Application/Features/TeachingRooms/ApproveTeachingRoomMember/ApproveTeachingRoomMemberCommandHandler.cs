using Microsoft.Extensions.Logging;
using QuizMaster.Application.Features.TeachingRooms.Shared;
using QuizMaster.Application.Realtime;

namespace QuizMaster.Application.Features.TeachingRooms.ApproveTeachingRoomMember;

public class ApproveTeachingRoomMemberCommandHandler(
    TeachingRoomRepository _roomRepository, TeachingMaterialRepository _materialRepository,
    ITeachingRoomBroadcaster _broadcaster, ILogger<ApproveTeachingRoomMemberCommandHandler> _logger)
    : IRequestHandler<ApproveTeachingRoomMemberCommand, IdResponse>
{
    public async Task<IdResponse> Handle(ApproveTeachingRoomMemberCommand command, CancellationToken ct)
    {
        var room = await _roomRepository.GetByIdOrThrowAsync(command.AggregateId, ct);
        if (room.Approve(command.StudentId, command))
            await _roomRepository.SaveChangesAsync(ct);

        // sent even when they were already admitted: approving again lets in a page that missed the first time
        var state = await _materialRepository.StateOfAsync(room, ct);
        await TeachingRoomSignals.SafelyAsync(_logger, room.Id, () => _broadcaster.AdmitAsync(room.Id, command.StudentId, state, ct));

        return new IdResponse(room.Id);
    }
}
