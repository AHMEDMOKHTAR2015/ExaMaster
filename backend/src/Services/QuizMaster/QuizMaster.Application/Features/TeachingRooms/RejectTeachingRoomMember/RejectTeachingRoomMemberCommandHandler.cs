using QuizMaster.Application.Realtime;

namespace QuizMaster.Application.Features.TeachingRooms.RejectTeachingRoomMember;

public class RejectTeachingRoomMemberCommandHandler(TeachingRoomRepository _roomRepository, ITeachingRoomBroadcaster _broadcaster)
    : IRequestHandler<RejectTeachingRoomMemberCommand, IdResponse>
{
    public async Task<IdResponse> Handle(RejectTeachingRoomMemberCommand command, CancellationToken ct)
    {
        var room = await _roomRepository.GetByIdOrThrowAsync(command.AggregateId, ct);
        if (room.Reject(command.StudentId, command))
            await _roomRepository.SaveChangesAsync(ct);

        //insight - not best-effort, unlike every other signal: if the student's pages could not be taken out of the room's
        // group, the teacher must hear it (and retry) rather than believe a removed student no longer sees the board.
        // A retry finds them already rejected and removes them again
        await _broadcaster.ExpelAsync(room.Id, command.StudentId, ct);

        return new IdResponse(room.Id);
    }
}
