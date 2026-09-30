namespace QuizMaster.Application.Features.Academic.ListGrades;

public class ListGradesQueryHandler(Repository<Grade> _gradeRepository)
    : IRequestHandler<ListGradesQuery, ListGradesResponse>
{
    public async Task<ListGradesResponse> Handle(ListGradesQuery query, CancellationToken ct)
    {
        var items = _gradeRepository.QueryNotTracked();

        if (query.StageId is { } stageId)
            items = items.Where(e => e.StageId == stageId);

        var list = await items.OrderBy(e => e.Order).ThenBy(e => e.Name).ToListAsync(ct);

        return new ListGradesResponse(list.Adapt<List<GradeDto>>());
    }
}
