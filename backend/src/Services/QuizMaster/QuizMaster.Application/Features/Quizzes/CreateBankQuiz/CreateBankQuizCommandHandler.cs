using QuizMaster.Application.Features.Quizzes.Shared;

namespace QuizMaster.Application.Features.Quizzes.CreateBankQuiz;

public class CreateBankQuizCommandHandler(BankQuizRepository _bankQuizRepository, BankQuizReferences _references)
    : IRequestHandler<CreateBankQuizCommand, IdResponse>
{
    public async Task<IdResponse> Handle(CreateBankQuizCommand command, CancellationToken ct)
    {
        var placement = new QuizPlacement(command.SubjectId, command.StageId, command.GradeId, command.ClassId, command.Semester);
        var (reviewer, questions) = await _references.LoadAsync(command.ReviewerId, command.QuestionIds, placement, ct);

        var quiz = BankQuiz.Create(command.Name, command.Description, command.Settings ?? QuizSettings.Default, placement, reviewer, questions, command);

        await _bankQuizRepository.AddAsync(quiz, ct);
        await _bankQuizRepository.SaveChangesAsync(ct);

        return new IdResponse(quiz.Id);
    }
}
