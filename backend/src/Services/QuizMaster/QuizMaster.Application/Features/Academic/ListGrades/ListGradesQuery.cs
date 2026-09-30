namespace QuizMaster.Application.Features.Academic.ListGrades;

// Reference data: readable by every member of the organization.
public record ListGradesQuery(int? StageId = null) : IQuery<ListGradesResponse>;
public record ListGradesResponse(IReadOnlyList<GradeDto> Grades);
