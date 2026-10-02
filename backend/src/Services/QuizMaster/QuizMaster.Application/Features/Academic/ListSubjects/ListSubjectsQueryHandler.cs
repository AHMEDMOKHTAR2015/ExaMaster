namespace QuizMaster.Application.Features.Academic.ListSubjects;

public class ListSubjectsQueryHandler(SubjectRepository _subjectRepository)
    : IRequestHandler<ListSubjectsQuery, ListSubjectsResponse>
{
    public async Task<ListSubjectsResponse> Handle(ListSubjectsQuery query, CancellationToken ct)
    {
        var items = _subjectRepository.QueryNotTracked();

        var list = await items.OrderBy(e => e.Name).ToListAsync(ct);

        return new ListSubjectsResponse(list.Adapt<List<SubjectDto>>());
    }
}
