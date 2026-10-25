namespace QuizMaster.Application.Features.TeachingMaterials.DeleteTeachingMaterial;

// The uploader or a school administrator removes a material, with its units and lessons.
public record DeleteTeachingMaterialCommand : QuizMasterCommand
{
    public override QuizMasterActionType ActionType => QuizMasterActionType.DeleteTeachingMaterial;
}

public class DeleteTeachingMaterialCommandValidator : QuizMasterCommandValidator<DeleteTeachingMaterialCommand>;
