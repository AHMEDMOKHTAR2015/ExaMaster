namespace QuizMaster.Application.Features.Academic.ListStages;

// Reference data: readable by every member of the organization.
public record ListStagesQuery : IQuery<ListStagesResponse>;
public record ListStagesResponse(IReadOnlyList<StageDto> Stages);
