using QuizMaster.Application.Features.TeacherQuizzes.Shared;

namespace QuizMaster.Application.Features.TeacherQuizzes.UpdateTeacherQuiz;

public class UpdateTeacherQuizCommandHandler(TeacherQuizRepository _teacherQuizRepository, SubjectRepository _subjectRepository, Repository<Stage> _stageRepository)
    : IRequestHandler<UpdateTeacherQuizCommand, IdResponse>
{
    public async Task<IdResponse> Handle(UpdateTeacherQuizCommand command, CancellationToken ct)
    {
        var quiz = await _teacherQuizRepository.GetByIdOrThrowAsync(command.AggregateId, ct);
        var subject = await _subjectRepository.LoadOrThrowAsync(command.SubjectId, ct);
        await _stageRepository.EnsureExistsAsync(command.StageId, ct);

        quiz.Update(
            command.Name, command.Description, command.Settings ?? QuizSettings.Default, subject, command.StageId, command.Semester,
            command.AuthorQuestions(subject), command);

        await _teacherQuizRepository.SaveChangesAsync(ct);

        return new IdResponse(quiz.Id);
    }
}
