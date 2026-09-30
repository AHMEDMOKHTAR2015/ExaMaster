using QuizMaster.Application.Features.Attempts.Shared;
using QuizMaster.Application.Features.Questions.Shared;

namespace QuizMaster.Application.Features.Attempts.SubmitQuiz;

// The one call that grades and records an attempt. The browser sends only what the student did; the server grades,
// records the attempt and returns the result WITH the answers (withheld until the due date for an assignment).
public record SubmitQuizCommand(
    int? HomeworkId,
    int? BankQuizId,
    int? TeacherQuizId,
    DateTimeOffset? StartedAt,
    List<QuestionResponse> Responses) : QuizMasterCommand<SubmitQuizResponse>, IAttemptTarget
{
    public override QuizMasterActionType ActionType => QuizMasterActionType.SubmitQuiz;
}

public record SubmitQuizResponse(
    int ParticipationId,
    int Score,
    int ScorePercent,
    int CorrectCount,
    int WrongCount,
    int PendingReviewCount,
    IReadOnlyList<ParticipationAnswerDto> Answers,
    IReadOnlyList<AnswerKeyDto> Key,        // empty while results are withheld
    bool ResultsAvailable,
    DateTime? ResultsAvailableAt);          // when withheld: the assignment's due date

public class SubmitQuizCommandValidator : AbstractValidator<SubmitQuizCommand>
{
    public const int MaxResponses = 500;

    public SubmitQuizCommandValidator()
    {
        this.AddAttemptTargetRules();

        RuleFor(c => c.Responses).NotNullWithMessage()
            .Must(responses => responses.Count <= MaxResponses).WithMessage($"A submission cannot carry more than {MaxResponses} responses.");
        RuleForEach(c => c.Responses).ChildRules(response =>
        {
            response.RuleFor(r => r.ResponseText).MaximumLengthWithMessage(QuestionCommandValidation.MaxHtmlLength, nameof(QuestionResponse.ResponseText));
            response.RuleFor(r => r.Blanks).Must(blanks => blanks is null || blanks.Count <= 100);
            response.RuleForEach(r => r.Blanks).ChildRules(blank =>
                blank.RuleFor(b => b.UserAnswer).MaximumLengthWithMessage(MaxLength.C512, nameof(BlankResponse.UserAnswer)));
        });
    }
}
