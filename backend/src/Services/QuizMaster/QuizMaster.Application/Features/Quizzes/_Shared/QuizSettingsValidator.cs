namespace QuizMaster.Application.Features.Quizzes.Shared;

public class QuizSettingsValidator : AbstractValidator<QuizSettings>
{
    public QuizSettingsValidator()
    {
        RuleFor(settings => settings.DurationSeconds).InclusiveBetween(0, QuizSettings.MaxDurationSeconds);
        RuleFor(settings => settings.PageSize).InclusiveBetween(1, QuizSettings.MaxPageSize);
        RuleFor(settings => settings.ImagePath).MaximumLengthWithMessage(MaxLength.C256, nameof(QuizSettings.ImagePath));
    }
}
