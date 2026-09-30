namespace QuizMaster.Application.Features.Questions.ReclassifyQuestions;

// Move many bank questions to another subject, stage, grade or semester at once. Only the fields given change; each
// question's text, options and answer stay as they are. Ids that no longer exist are skipped.
public record ReclassifyQuestionsCommand(List<int> QuestionIds, int? SubjectId, int? StageId, int? GradeId, Semester? Semester)
    : QuizMasterCommand<ReclassifyQuestionsResponse>
{
    public override QuizMasterActionType ActionType => QuizMasterActionType.ReclassifyQuestions;
}

public record ReclassifyQuestionsResponse(int UpdatedCount);

public class ReclassifyQuestionsCommandValidator : AbstractValidator<ReclassifyQuestionsCommand>
{
    public ReclassifyQuestionsCommandValidator()
    {
        RuleFor(c => c.QuestionIds).NotEmpty().Must(ids => ids.Count <= 1000).WithMessage("Reclassify at most 1000 questions at a time.");
        RuleFor(c => c).Must(c => c.SubjectId is not null || c.StageId is not null || c.GradeId is not null || c.Semester is not null)
            .WithMessage("Choose at least one of subject, stage, grade or semester.").OverridePropertyName("subjectId");
        RuleFor(c => c.Semester).IsInEnum();
    }
}
