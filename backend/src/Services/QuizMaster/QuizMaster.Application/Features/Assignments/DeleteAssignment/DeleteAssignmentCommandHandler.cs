namespace QuizMaster.Application.Features.Assignments.DeleteAssignment;

public class DeleteAssignmentCommandHandler(Repository<HomeworkAssignment> _assignmentRepository)
    : IRequestHandler<DeleteAssignmentCommand, IdResponse>
{
    public async Task<IdResponse> Handle(DeleteAssignmentCommand command, CancellationToken ct)
    {
        var assignment = await _assignmentRepository.GetByIdOrThrowAsync(command.AggregateId, ct);

        _assignmentRepository.Remove(assignment);
        await _assignmentRepository.SaveChangesAsync(ct);

        return new IdResponse(assignment.Id);
    }
}
