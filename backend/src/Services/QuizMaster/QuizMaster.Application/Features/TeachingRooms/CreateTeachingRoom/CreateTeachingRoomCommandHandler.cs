namespace QuizMaster.Application.Features.TeachingRooms.CreateTeachingRoom;

public class CreateTeachingRoomCommandHandler(
    TeachingRoomRepository _roomRepository, TeachingMaterialRepository _materialRepository, QuizMasterDbContext _dbContext)
    : IRequestHandler<CreateTeachingRoomCommand, IdResponse>
{
    public async Task<IdResponse> Handle(CreateTeachingRoomCommand command, CancellationToken ct)
    {
        var material = await _materialRepository.LoadOrThrowAsync(command.TeachingMaterialId, ct);
        var presenter = await _dbContext.FindTeacherRecordAsync(command.CreatedById, ct)
            ?? throw new ForbiddenException("Your account is not linked to a teacher record, so you cannot present material yet. Ask the school administrator to link it.");

        var room = TeachingRoom.Open(material, presenter, command);

        await _roomRepository.AddAsync(room, ct);
        await _roomRepository.SaveChangesAsync(ct);

        return new IdResponse(room.Id);
    }
}
