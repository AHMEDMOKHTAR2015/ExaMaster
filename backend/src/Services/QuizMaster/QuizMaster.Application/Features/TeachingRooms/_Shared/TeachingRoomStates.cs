namespace QuizMaster.Application.Features.TeachingRooms.Shared;

public static class TeachingRoomStates
{
    // The board as every admitted screen shows it. The lesson is read through the material's own repository and mapped
    // by its own config (MaterialLesson → MaterialLessonDto), exactly as the material reader receives it.
    public static async Task<TeachingRoomStateDto> StateOfAsync(this TeachingMaterialRepository materials, TeachingRoom room, CancellationToken ct)
    {
        var stop = await materials.GetLessonAtAsync(room.TeachingMaterialId, room.CurrentPosition, ct)
            ?? throw new NotFoundException("The material this room presents is no longer available.");

        var item = new TeachingRoomItemDto(
            stop.Unit.Number, stop.Unit.Kind, stop.Unit.Title, stop.Unit.KeyTakeaways, stop.ClosesUnit, stop.Lesson.Adapt<MaterialLessonDto>());

        return new TeachingRoomStateDto(room.Id, room.CurrentPosition, room.ItemCount, room.CanGoPrevious, room.CanGoNext, room.Revision, item);
    }
}
