using QuizMaster.Application.Features.TeacherQuizzes.Shared;

namespace QuizMaster.Application.Features.TeacherQuizzes.CreateTeacherQuiz;

// A quiz a teacher authors for their own classes; its questions and answers are private to it.
public record CreateTeacherQuizCommand(
    string Name,
    string? Description,
    QuizSettings? Settings,
    int SubjectId,
    int? StageId,
    Semester? Semester,
    List<QuestionDraftDto> Questions) : QuizMasterCommand, ITeacherQuizInput
{
    public override QuizMasterActionType ActionType => QuizMasterActionType.CreateTeacherQuiz;
}

public class CreateTeacherQuizCommandValidator : AbstractValidator<CreateTeacherQuizCommand>
{
    public CreateTeacherQuizCommandValidator() => this.AddTeacherQuizRules();
}
