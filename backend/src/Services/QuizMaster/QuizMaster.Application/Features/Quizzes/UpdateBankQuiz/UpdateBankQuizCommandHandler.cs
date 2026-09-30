using QuizMaster.Application.Features.Quizzes.Shared;

namespace QuizMaster.Application.Features.Quizzes.UpdateBankQuiz;

public class UpdateBankQuizCommandHandler(BankQuizRepository _bankQuizRepository, BankQuizReferences _references)
    : IRequestHandler<UpdateBankQuizCommand, IdResponse>
{
    public async Task<IdResponse> Handle(UpdateBankQuizCommand command, CancellationToken ct)
    {
        var quiz = await _bankQuizRepository.GetByIdOrThrowAsync(command.AggregateId, ct);

        var placement = new QuizPlacement(command.SubjectId, command.StageId, command.GradeId, command.ClassId, command.Semester);
        var (reviewer, questions) = await _references.LoadAsync(command.ReviewerId, command.QuestionIds, placement, ct);

        quiz.Update(command.Name, command.Description, command.Settings ?? QuizSettings.Default, placement, reviewer, questions, command);

        await _bankQuizRepository.SaveChangesAsync(ct);

        return new IdResponse(quiz.Id);
    }
}
