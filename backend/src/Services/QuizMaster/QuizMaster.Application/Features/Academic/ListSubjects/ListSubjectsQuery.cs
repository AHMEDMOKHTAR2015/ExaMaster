namespace QuizMaster.Application.Features.Academic.ListSubjects;

// Reference data: readable by every member of the organization.
public record ListSubjectsQuery : IQuery<ListSubjectsResponse>;
public record ListSubjectsResponse(IReadOnlyList<SubjectDto> Subjects);
