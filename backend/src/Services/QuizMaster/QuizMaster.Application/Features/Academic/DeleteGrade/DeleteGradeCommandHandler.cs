namespace QuizMaster.Application.Features.Academic.DeleteGrade;

public class DeleteGradeCommandHandler(Repository<Grade> _gradeRepository)
    : IRequestHandler<DeleteGradeCommand, IdResponse>
{
    public async Task<IdResponse> Handle(DeleteGradeCommand command, CancellationToken ct)
    {
        var grade = await _gradeRepository.GetByIdOrThrowAsync(command.AggregateId, ct);

        _gradeRepository.Remove(grade);
        await _gradeRepository.SaveChangesAsync(ct);

        return new IdResponse(grade.Id);
    }
}
