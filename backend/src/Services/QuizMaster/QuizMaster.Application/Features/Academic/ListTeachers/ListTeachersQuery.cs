namespace QuizMaster.Application.Features.Academic.ListTeachers;

// Reference data: readable by every member of the organization.
public record ListTeachersQuery(int? SubjectId = null) : IQuery<ListTeachersResponse>;
public record ListTeachersResponse(IReadOnlyList<TeacherDto> Teachers);
