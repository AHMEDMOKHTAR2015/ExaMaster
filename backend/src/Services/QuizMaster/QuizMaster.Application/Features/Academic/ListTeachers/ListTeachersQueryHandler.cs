namespace QuizMaster.Application.Features.Academic.ListTeachers;

public class ListTeachersQueryHandler(Repository<Teacher> _teacherRepository, QuizMasterDbContext _dbContext)
    : IRequestHandler<ListTeachersQuery, ListTeachersResponse>
{
    public async Task<ListTeachersResponse> Handle(ListTeachersQuery query, CancellationToken ct)
    {
        var items = _teacherRepository.QueryNotTracked();

        if (query.SubjectId is { } subjectId)
            items = items.Where(e => e.SubjectIds.Contains(subjectId));
        if (TextSearch.ContainsPattern(query.Search) is { } pattern)
            items = items.Where(e => EF.Functions.Like(e.FirstName + " " + e.LastName, pattern, TextSearch.EscapeCharacter)
                || EF.Functions.Like(e.Email!, pattern, TextSearch.EscapeCharacter)
                || _dbContext.Subjects.Any(subject => e.SubjectIds.Contains(subject.Id) && EF.Functions.Like(subject.Name, pattern, TextSearch.EscapeCharacter)));

        var list = await items.OrderBy(e => e.LastName).ThenBy(e => e.FirstName).ToListAsync(ct);

        return new ListTeachersResponse(list.Adapt<List<TeacherDto>>());
    }
}
