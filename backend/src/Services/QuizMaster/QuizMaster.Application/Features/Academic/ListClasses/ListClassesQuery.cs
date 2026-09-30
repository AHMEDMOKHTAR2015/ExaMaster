namespace QuizMaster.Application.Features.Academic.ListClasses;

// Reference data: readable by every member of the organization.
public record ListClassesQuery(int? StageId = null, int? GradeId = null) : IQuery<ListClassesResponse>;
public record ListClassesResponse(IReadOnlyList<ClassGroupDto> Classes);
