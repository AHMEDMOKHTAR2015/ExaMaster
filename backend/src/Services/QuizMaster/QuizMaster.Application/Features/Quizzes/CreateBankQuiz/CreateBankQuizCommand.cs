using QuizMaster.Application.Features.Quizzes.Shared;

namespace QuizMaster.Application.Features.Quizzes.CreateBankQuiz;

// A quiz in the shared bank: bank questions in order, and the teacher (a user id) who reviews its Explain/Complete answers.
public record CreateBankQuizCommand(
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
    public override QuizMasterActionType ActionType => QuizMasterActionType.CreateQuiz;
}

public class CreateBankQuizCommandValidator : AbstractValidator<CreateBankQuizCommand>
{
    public CreateBankQuizCommandValidator()
    {
        RuleFor(c => c.Name).NotEmptyWithMessage(nameof(CreateBankQuizCommand.Name)).MaximumLengthWithMessage(BankQuiz.MaxNameLength, nameof(CreateBankQuizCommand.Name));
        RuleFor(c => c.Description).MaximumLengthWithMessage(BankQuiz.MaxDescriptionLength, nameof(CreateBankQuizCommand.Description));
        RuleFor(c => c.Settings!).SetValidator(new QuizSettingsValidator()).When(c => c.Settings is not null);
        RuleFor(c => c.ReviewerId).GreaterThan(0).WithMessageForInvalidId(nameof(CreateBankQuizCommand.ReviewerId));
        RuleFor(c => c.QuestionIds).NotEmptyWithMessage(nameof(CreateBankQuizCommand.QuestionIds));
    }
}
