using QuizMaster.Application.Features.TeacherQuizzes.Shared;

namespace QuizMaster.Application.Features.TeacherQuizzes.UpdateTeacherQuiz;

// Only the authoring teacher (or an administrator) may change it: see QuizMasterAccessChecker.
public record UpdateTeacherQuizCommand(
    string Name,
    string? Description,
    QuizSettings? Settings,
    int SubjectId,
    int? StageId,
    Semester? Semester,
    List<QuestionDraftDto> Questions) : QuizMasterCommand, ITeacherQuizInput
{
    public override QuizMasterActionType ActionType => QuizMasterActionType.UpdateTeacherQuiz;
}

public class UpdateTeacherQuizCommandValidator : QuizMasterCommandValidator<UpdateTeacherQuizCommand>
{
    public UpdateTeacherQuizCommandValidator() => this.AddTeacherQuizRules();
}
