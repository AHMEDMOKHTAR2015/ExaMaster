namespace QuizMaster.Application.Features.Academic.ListClasses;

public class ListClassesQueryHandler(Repository<ClassGroup> _classGroupRepository)
    : IRequestHandler<ListClassesQuery, ListClassesResponse>
{
    public async Task<ListClassesResponse> Handle(ListClassesQuery query, CancellationToken ct)
    {
        var items = _classGroupRepository.QueryNotTracked();

        if (query.StageId is { } stageId)
            items = items.Where(e => e.StageId == stageId);
        if (query.GradeId is { } gradeId)
            items = items.Where(e => e.GradeId == gradeId);

        var list = await items.OrderBy(e => e.Name).ToListAsync(ct);

        return new ListClassesResponse(list.Adapt<List<ClassGroupDto>>());
    }
}
