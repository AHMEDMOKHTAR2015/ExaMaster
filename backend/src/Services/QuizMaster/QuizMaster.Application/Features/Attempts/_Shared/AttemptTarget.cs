namespace QuizMaster.Application.Features.Attempts.Shared;

// What a student is sitting: an assignment (whose quiz is then authoritative), or a quiz practised on its own.
public interface IAttemptTarget
{
    int? HomeworkId { get; }
    int? BankQuizId { get; }
    int? TeacherQuizId { get; }
}

public static class AttemptTargetValidation
{
    public static void AddAttemptTargetRules<T>(this AbstractValidator<T> validator)
        where T : IAttemptTarget
        => validator.RuleFor(target => target)
            .Must(target => new[] { target.HomeworkId, target.BankQuizId, target.TeacherQuizId }.Count(id => id is not null) == 1)
            .WithMessage("Name exactly one of homeworkId, bankQuizId or teacherQuizId.")
            .OverridePropertyName("target");
}
