namespace QuizMaster.Application.Features.Users.PlaceStudent;

public class PlaceStudentCommandHandler(Repository<User> _userRepository, Repository<ClassGroup> _classRepository)
    : IRequestHandler<PlaceStudentCommand, IdResponse>
{
    public async Task<IdResponse> Handle(PlaceStudentCommand command, CancellationToken ct)
    {
        var student = await _userRepository.GetByIdOrThrowAsync(command.AggregateId, ct);
        var classGroup = await _classRepository.LoadOrThrowAsync(command.ClassId, ct);

        student.PlaceInClass(classGroup, command);

        await _userRepository.SaveChangesAsync(ct);

        return new IdResponse(student.Id);
    }
}
