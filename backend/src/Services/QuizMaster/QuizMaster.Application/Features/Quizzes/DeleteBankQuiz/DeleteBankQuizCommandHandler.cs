namespace QuizMaster.Application.Features.Quizzes.DeleteBankQuiz;

public class DeleteBankQuizCommandHandler(BankQuizRepository _bankQuizRepository)
    : IRequestHandler<DeleteBankQuizCommand, IdResponse>
{
    public async Task<IdResponse> Handle(DeleteBankQuizCommand command, CancellationToken ct)
    {
        var quiz = await _bankQuizRepository.GetByIdOrThrowAsync(command.AggregateId, ct);

        _bankQuizRepository.Remove(quiz);
        await _bankQuizRepository.SaveChangesAsync(ct);

        return new IdResponse(quiz.Id);
    }
}
