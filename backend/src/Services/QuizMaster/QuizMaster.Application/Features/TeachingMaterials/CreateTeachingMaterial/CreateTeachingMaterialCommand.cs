using System.Text.Json;
using QuizMaster.Application.Features.TeachingMaterials.Shared;

namespace QuizMaster.Application.Features.TeachingMaterials.CreateTeachingMaterial;

// A teacher uploads a teaching-summary document for one of their subjects, in a grade they choose.
public record CreateTeachingMaterialCommand(int SubjectId, int GradeId, JsonElement Document) : QuizMasterCommand
{
    public override QuizMasterActionType ActionType => QuizMasterActionType.CreateTeachingMaterial;
}

public class CreateTeachingMaterialCommandValidator : AbstractValidator<CreateTeachingMaterialCommand>
{
    public CreateTeachingMaterialCommandValidator()
    {
        RuleFor(c => c.SubjectId).GreaterThan(0).WithMessageForInvalidId(nameof(CreateTeachingMaterialCommand.SubjectId));
        RuleFor(c => c.GradeId).GreaterThan(0).WithMessageForInvalidId(nameof(CreateTeachingMaterialCommand.GradeId));

        // every problem in the document at once (up to 20), each naming where it is: "Unit 2, lesson 3, block 4 (table): row 2"
        RuleFor(c => c.Document).Custom((document, context) =>
        {
            foreach (var error in MaterialDocument.Read(document).Errors)
                context.AddFailure(error.Path, error.Message);
        });
    }
}
