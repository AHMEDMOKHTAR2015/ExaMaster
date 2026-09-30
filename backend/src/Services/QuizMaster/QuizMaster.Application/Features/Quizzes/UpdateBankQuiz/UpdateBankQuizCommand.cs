using QuizMaster.Application.Features.Quizzes.Shared;

namespace QuizMaster.Application.Features.Quizzes.UpdateBankQuiz;

public record UpdateBankQuizCommand(
    string Name,
    string? Description,
    QuizSettings? Settings,
    int? SubjectId,
    int? StageId,
    int? GradeId,
    int? ClassId,
    Semester? Semester,
    int ReviewerId,
    List<int> QuestionIds) : QuizMasterCommand
{
    public override QuizMasterActionType ActionType => QuizMasterActionType.UpdateQuiz;
}

public class UpdateBankQuizCommandValidator : QuizMasterCommandValidator<UpdateBankQuizCommand>
{
    public UpdateBankQuizCommandValidator()
    {
        RuleFor(c => c.Name).NotEmptyWithMessage(nameof(UpdateBankQuizCommand.Name)).MaximumLengthWithMessage(BankQuiz.MaxNameLength, nameof(UpdateBankQuizCommand.Name));
        RuleFor(c => c.Description).MaximumLengthWithMessage(BankQuiz.MaxDescriptionLength, nameof(UpdateBankQuizCommand.Description));
        RuleFor(c => c.Settings!).SetValidator(new QuizSettingsValidator()).When(c => c.Settings is not null);
        RuleFor(c => c.ReviewerId).GreaterThan(0).WithMessageForInvalidId(nameof(UpdateBankQuizCommand.ReviewerId));
        RuleFor(c => c.QuestionIds).NotEmptyWithMessage(nameof(UpdateBankQuizCommand.QuestionIds));
    }
}
