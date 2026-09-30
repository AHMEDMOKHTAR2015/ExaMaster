namespace QuizMaster.Application.Features.Academic.ListStages;

public class ListStagesQueryHandler(Repository<Stage> _stageRepository)
    : IRequestHandler<ListStagesQuery, ListStagesResponse>
{
    public async Task<ListStagesResponse> Handle(ListStagesQuery query, CancellationToken ct)
    {
        var items = _stageRepository.QueryNotTracked();

        var list = await items.OrderBy(e => e.Order).ThenBy(e => e.Name).ToListAsync(ct);

        return new ListStagesResponse(list.Adapt<List<StageDto>>());
    }
}
