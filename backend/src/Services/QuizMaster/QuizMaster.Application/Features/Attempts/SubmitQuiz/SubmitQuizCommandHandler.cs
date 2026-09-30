using QuizMaster.Application.Features.Attempts.Shared;
using QuizMaster.Application.Features.Participations.Shared;

namespace QuizMaster.Application.Features.Attempts.SubmitQuiz;

public class SubmitQuizCommandHandler(
    ParticipationRepository _participationRepository,
    QuizAttemptLockRepository _attemptLockRepository,
    Repository<User> _userRepository,
    AttemptedQuizLoader _quizLoader)
    : IRequestHandler<SubmitQuizCommand, SubmitQuizResponse>
{
    public async Task<SubmitQuizResponse> Handle(SubmitQuizCommand command, CancellationToken ct)
    {
        var student = await _userRepository.GetByIdOrThrowAsync(command.CreatedById, ct);   // always the caller, never the payload
        var (quiz, homework) = await _quizLoader.LoadAsync(command, ct);
        var latestAttempt = homework is null ? null : await _participationRepository.GetLatestAttemptAsync(student.Id, homework.Id, ct);

        var participation = Participation.Submit(
            student, quiz, homework, latestAttempt, command.Responses, command.StartedAt?.UtcDateTime, command);
        await _participationRepository.AddAsync(participation, ct);

        //insight - the one handler that touches two aggregates, on purpose: finishing a One Time Join attempt is what lifts
        // its lock, and both commit in ONE transaction, so a recorded submission always leaves the student unlocked
        // and a failed one never does
        if (quiz.Settings.OneTimeJoin
            && await _attemptLockRepository.GetForScopeAsync(student.Id, AttemptScope.KeyFor(quiz, homework), ct) is { } attemptLock)
            attemptLock.ReleaseOnSubmission(command);

        await _participationRepository.SaveChangesAsync(ct);

        var resultsAvailable = participation.AreResultsAvailableTo(homework, command.CreatedOn);
        return new SubmitQuizResponse(
            participation.Id,
            participation.Score,
            participation.ScorePercent,
            participation.CorrectCount,
            participation.WrongCount,
            participation.PendingReviewCount,
            participation.Answers.OrderBy(answer => answer.Position).Select(answer => ParticipationViews.ToDto(answer, resultsAvailable)).ToList(),
            resultsAvailable
                ? quiz.Questions.Select(question => new AnswerKeyDto(question.QuestionId, question.Key.CorrectOptionId, question.Key.CorrectBlanks, question.Key.ReferenceAnswer)).ToList()
                : [],
            resultsAvailable,
            resultsAvailable ? null : homework!.DueAt);
    }
}
