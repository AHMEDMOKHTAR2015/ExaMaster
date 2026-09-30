using QuizMaster.Application.Features.TeacherQuizzes.Shared;

namespace QuizMaster.Application.Features.TeacherQuizzes.CreateTeacherQuiz;

public class CreateTeacherQuizCommandHandler(TeacherQuizRepository _teacherQuizRepository, Repository<Subject> _subjectRepository, Repository<Stage> _stageRepository)
    : IRequestHandler<CreateTeacherQuizCommand, IdResponse>
{
    public async Task<IdResponse> Handle(CreateTeacherQuizCommand command, CancellationToken ct)
    {
        var subject = await _subjectRepository.LoadOrThrowAsync(command.SubjectId, ct);
        await _stageRepository.EnsureExistsAsync(command.StageId, ct);

        var quiz = TeacherQuiz.Create(
            command.Name, command.Description, command.Settings ?? QuizSettings.Default, subject, command.StageId, command.Semester,
            command.AuthorQuestions(), command);

        await _teacherQuizRepository.AddAsync(quiz, ct);
        await _teacherQuizRepository.SaveChangesAsync(ct);

        return new IdResponse(quiz.Id);
    }
}
