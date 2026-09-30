using QuizMaster.Application.Features.Questions.Shared;
using QuizMaster.Application.Features.Quizzes.Shared;

namespace QuizMaster.Application.Features.TeacherQuizzes.Shared;

public interface ITeacherQuizInput
{
    string Name { get; }
    string? Description { get; }
    QuizSettings? Settings { get; }
    int SubjectId { get; }
    List<QuestionDraftDto> Questions { get; }
}

public static class TeacherQuizValidation
{
    public static void AddTeacherQuizRules<T>(this AbstractValidator<T> validator)
        where T : ITeacherQuizInput
    {
        validator.RuleFor(c => c.Name).NotEmptyWithMessage(nameof(ITeacherQuizInput.Name)).MaximumLengthWithMessage(TeacherQuiz.MaxNameLength, nameof(ITeacherQuizInput.Name));
        validator.RuleFor(c => c.Description).MaximumLengthWithMessage(TeacherQuiz.MaxDescriptionLength, nameof(ITeacherQuizInput.Description));
        validator.RuleFor(c => c.Settings!).SetValidator(new QuizSettingsValidator()).When(c => c.Settings is not null);
        validator.RuleFor(c => c.SubjectId).GreaterThan(0).WithMessageForInvalidId(nameof(ITeacherQuizInput.SubjectId));
        validator.RuleFor(c => c.Questions).NotEmptyWithMessage(nameof(ITeacherQuizInput.Questions))
            .Must(questions => questions.Count <= TeacherQuiz.MaxQuestions)
            .WithMessage($"A quiz cannot have more than {TeacherQuiz.MaxQuestions} questions.");
        validator.RuleForEach(c => c.Questions).SetValidator(new QuestionDraftDtoValidator());
    }

    public static IReadOnlyList<AuthoredQuestion> AuthorQuestions(this ITeacherQuizInput input)
        => AuthoredQuestion.FromAll(input.Questions.Select(question => question.ToDraft()).ToList());
}

public class QuestionDraftDtoValidator : AbstractValidator<QuestionDraftDto>
{
    public QuestionDraftDtoValidator()
        => this.AddQuestionContentRules(q => q.Type, q => q.Text, q => q.Options, q => q.SubjectHtml, q => q.ReferenceAnswer);
}
