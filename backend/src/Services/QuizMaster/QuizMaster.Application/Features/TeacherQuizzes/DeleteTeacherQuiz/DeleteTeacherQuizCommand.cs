namespace QuizMaster.Application.Features.TeacherQuizzes.DeleteTeacherQuiz;

// Refused (409) while an assignment still sets the quiz. Past attempts survive, carrying the quiz's name.
public record DeleteTeacherQuizCommand : QuizMasterCommand
{
    public override QuizMasterActionType ActionType => QuizMasterActionType.DeleteTeacherQuiz;
}

public class DeleteTeacherQuizCommandValidator : QuizMasterCommandValidator<DeleteTeacherQuizCommand>;
