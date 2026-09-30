namespace QuizMaster.Application.Features.Academic.ListTeachers;

public class ListTeachersQueryHandler(Repository<Teacher> _teacherRepository)
    : IRequestHandler<ListTeachersQuery, ListTeachersResponse>
{
    public async Task<ListTeachersResponse> Handle(ListTeachersQuery query, CancellationToken ct)
    {
        var items = _teacherRepository.QueryNotTracked();

        if (query.SubjectId is { } subjectId)
            items = items.Where(e => e.SubjectIds.Contains(subjectId));

        var list = await items.OrderBy(e => e.LastName).ThenBy(e => e.FirstName).ToListAsync(ct);

        return new ListTeachersResponse(list.Adapt<List<TeacherDto>>());
    }
}
