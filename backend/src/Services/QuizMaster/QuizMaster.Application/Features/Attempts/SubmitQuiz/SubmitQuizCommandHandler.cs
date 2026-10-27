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

        //insight - an attempt sent again (its response was lost on the way back, and the student pressed Submit once more)
        // is answered with what was recorded: not graded twice, and not refused as a second submission of the assignment
        if (await RecordedUnderKeyAsync(command, quiz, homework, ct) is { } recorded)
            return ToResponse(recorded, quiz, homework, command.CreatedOn);

        var latestAttempt = homework is null ? null : await _participationRepository.GetLatestAttemptAsync(student.Id, homework.Id, ct);

        var participation = Participation.Submit(
            student, quiz, homework, latestAttempt, command.Responses, command.StartedAt?.UtcDateTime, command.SubmissionKey, command);
        await _participationRepository.AddAsync(participation, ct);

        //insight - the one handler that touches two aggregates, on purpose: finishing a One Time Join attempt is what lifts
        // its lock, and both commit in ONE transaction, so a recorded submission always leaves the student unlocked
        // and a failed one never does
        if (quiz.Settings.OneTimeJoin
            && await _attemptLockRepository.GetForScopeAsync(student.Id, AttemptScope.KeyFor(quiz, homework), ct) is { } attemptLock)
            attemptLock.ReleaseOnSubmission(command);

        try
        {
            await _participationRepository.SaveChangesAsync(ct);
        }
        catch (ConflictException)
        {
            // the same attempt sent twice at once: the copy that lost the race answers with the one that won
            if (await RecordedUnderKeyAsync(command, quiz, homework, ct) is { } winner)
                return ToResponse(winner, quiz, homework, command.CreatedOn);
            // two attempts at one assignment both passed the "already submitted" check: the second claimed a taken number
            if (homework is not null)
                throw new ConflictException("You have already submitted this assignment.");
            throw;
        }

        return ToResponse(participation, quiz, homework, command.CreatedOn);
    }

    private async Task<Participation?> RecordedUnderKeyAsync(
        SubmitQuizCommand command, AttemptedQuiz quiz, HomeworkAssignment? homework, CancellationToken ct)
    {
        if (command.SubmissionKey is not { } submissionKey)
            return null;

        var recorded = await _participationRepository.GetBySubmissionKeyAsync(command.CreatedById, submissionKey, ct);
        if (recorded is not null && !recorded.Records(quiz, homework))
            throw new ConflictException("This submission key was already used for another quiz.");
        return recorded;
    }

    private static SubmitQuizResponse ToResponse(Participation participation, AttemptedQuiz quiz, HomeworkAssignment? homework, DateTime now)
    {
        var resultsAvailable = participation.AreResultsAvailableTo(homework, now);
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
