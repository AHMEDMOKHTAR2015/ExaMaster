namespace QuizMaster.Application.Features.Academic.CreateGrade;

public class CreateGradeCommandHandler(Repository<Grade> _gradeRepository, Repository<Stage> _stageRepository)
    : IRequestHandler<CreateGradeCommand, IdResponse>
{
    public async Task<IdResponse> Handle(CreateGradeCommand command, CancellationToken ct)
    {
        var stage = await _stageRepository.LoadOrThrowAsync(command.StageId, ct);

        var grade = Grade.Create(stage, command.Name, command.Order, command);

        await _gradeRepository.AddAsync(grade, ct);
        await _gradeRepository.SaveChangesAsync(ct);

        return new IdResponse(grade.Id);
    }
}
