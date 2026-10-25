namespace QuizMaster.Application.Features.TeachingMaterials.GetTeachingMaterial;

// The whole material, units and lessons in order, for its reader. Who may read it is QuizMasterAccessChecker's call.
public record GetTeachingMaterialQuery(int Id) : IQuery<GetTeachingMaterialResponse>;
public record GetTeachingMaterialResponse(TeachingMaterialDto Material);

public class GetTeachingMaterialQueryValidator : AbstractValidator<GetTeachingMaterialQuery>
{
    public GetTeachingMaterialQueryValidator()
        => RuleFor(q => q.Id).GreaterThan(0).WithMessageForInvalidId(nameof(GetTeachingMaterialQuery.Id));
}
