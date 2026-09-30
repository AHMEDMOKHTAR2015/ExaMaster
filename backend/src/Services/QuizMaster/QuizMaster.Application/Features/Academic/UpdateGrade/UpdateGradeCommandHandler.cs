namespace QuizMaster.Application.Features.Academic.UpdateGrade;

public class UpdateGradeCommandHandler(Repository<Grade> _gradeRepository, Repository<Stage> _stageRepository)
    : IRequestHandler<UpdateGradeCommand, IdResponse>
{
    public async Task<IdResponse> Handle(UpdateGradeCommand command, CancellationToken ct)
    {
        var grade = await _gradeRepository.GetByIdOrThrowAsync(command.AggregateId, ct);
        var stage = await _stageRepository.LoadOrThrowAsync(command.StageId, ct);

        grade.Update(stage, command.Name, command.Order, command);

        await _gradeRepository.SaveChangesAsync(ct);

        return new IdResponse(grade.Id);
    }
}
