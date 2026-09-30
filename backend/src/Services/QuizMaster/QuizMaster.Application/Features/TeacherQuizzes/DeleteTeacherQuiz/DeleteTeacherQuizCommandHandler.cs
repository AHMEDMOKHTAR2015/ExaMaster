namespace QuizMaster.Application.Features.TeacherQuizzes.DeleteTeacherQuiz;

public class DeleteTeacherQuizCommandHandler(TeacherQuizRepository _teacherQuizRepository)
    : IRequestHandler<DeleteTeacherQuizCommand, IdResponse>
{
    public async Task<IdResponse> Handle(DeleteTeacherQuizCommand command, CancellationToken ct)
    {
        var quiz = await _teacherQuizRepository.GetByIdOrThrowAsync(command.AggregateId, ct);

        _teacherQuizRepository.Remove(quiz);
        await _teacherQuizRepository.SaveChangesAsync(ct);

        return new IdResponse(quiz.Id);
    }
}
