namespace QuizMaster.Application.Features.TeachingMaterials.ListTeachingMaterials;

// A teacher sees the material they uploaded; a school administrator sees everyone's.
public record ListTeachingMaterialsQuery(int? SubjectId = null, int? GradeId = null) : IQuery<ListTeachingMaterialsResponse>;
public record ListTeachingMaterialsResponse(IReadOnlyList<TeachingMaterialSummaryDto> Materials);

public class ListTeachingMaterialsQueryValidator : AbstractValidator<ListTeachingMaterialsQuery>
{
    public ListTeachingMaterialsQueryValidator()
    {
        RuleFor(q => q.SubjectId).GreaterThan(0).When(q => q.SubjectId is not null).WithMessageForInvalidId(nameof(ListTeachingMaterialsQuery.SubjectId));
        RuleFor(q => q.GradeId).GreaterThan(0).When(q => q.GradeId is not null).WithMessageForInvalidId(nameof(ListTeachingMaterialsQuery.GradeId));
    }
}
