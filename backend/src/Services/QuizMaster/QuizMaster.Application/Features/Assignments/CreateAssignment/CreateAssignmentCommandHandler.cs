using QuizMaster.Application.Features.Assignments.Shared;

namespace QuizMaster.Application.Features.Assignments.CreateAssignment;

public class CreateAssignmentCommandHandler(Repository<HomeworkAssignment> _assignmentRepository, AssignmentReferences _references)
    : IRequestHandler<CreateAssignmentCommand, IdResponse>
{
    public async Task<IdResponse> Handle(CreateAssignmentCommand command, CancellationToken ct)
    {
        var (quiz, targetClass, children) = await _references.LoadAsync(command, ct);

        var assignment = HomeworkAssignment.Create(
            command.Title, command.Kind, quiz, targetClass, command.SubjectId, command.Semester, command.DueAt.UtcDateTime, children, command);

        await _assignmentRepository.AddAsync(assignment, ct);
        await _assignmentRepository.SaveChangesAsync(ct);

        return new IdResponse(assignment.Id);
    }
}
