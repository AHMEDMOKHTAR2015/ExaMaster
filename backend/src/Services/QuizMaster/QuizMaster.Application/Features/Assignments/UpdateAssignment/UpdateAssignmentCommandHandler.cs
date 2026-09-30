using QuizMaster.Application.Features.Assignments.Shared;

namespace QuizMaster.Application.Features.Assignments.UpdateAssignment;

public class UpdateAssignmentCommandHandler(Repository<HomeworkAssignment> _assignmentRepository, AssignmentReferences _references)
    : IRequestHandler<UpdateAssignmentCommand, IdResponse>
{
    public async Task<IdResponse> Handle(UpdateAssignmentCommand command, CancellationToken ct)
    {
        var assignment = await _assignmentRepository.GetByIdOrThrowAsync(command.AggregateId, ct);
        var (quiz, targetClass, children) = await _references.LoadAsync(command, ct);

        assignment.Update(
            command.Title, command.Kind, quiz, targetClass, command.SubjectId, command.Semester, command.DueAt.UtcDateTime,
            command.IsActive, children, command);

        await _assignmentRepository.SaveChangesAsync(ct);

        return new IdResponse(assignment.Id);
    }
}
