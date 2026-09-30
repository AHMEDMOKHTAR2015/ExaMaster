namespace QuizMaster.Application.Features.Participations.Shared;

public static class ParticipationViews
{
    public static ParticipationDto ToDto(Participation participation, bool resultsAvailable)
        => participation.Adapt<ParticipationDto>() with
        {
            ResultsAvailable = resultsAvailable,
            Answers = participation.Answers.OrderBy(answer => answer.Position).Select(answer => ToDto(answer, resultsAvailable)).ToList()
        };

    //insight - before an assignment is due, a student sees their verdicts but not the correct answers: the persisted record
    // always keeps the full detail (a teacher grading needs it); only what is SENT is redacted, by the domain's own rule
    public static ParticipationAnswerDto ToDto(ParticipationAnswer answer, bool resultsAvailable)
    {
        var dto = answer.Adapt<ParticipationAnswerDto>();
        if (resultsAvailable)
            return dto;

        var redacted = QuizGrader.Redact(answer.ToGradedAnswer());
        return dto with
        {
            CorrectOptionId = redacted.CorrectOptionId,
            CorrectOptionText = redacted.CorrectOptionText,
            ReferenceAnswer = redacted.ReferenceAnswer,
            Blanks = redacted.Blanks
        };
    }

    public static IQueryable<ParticipationSummaryDto> ToSummaries(this IQueryable<Participation> participations, QuizMasterDbContext dbContext)
        => participations.Select(participation => new ParticipationSummaryDto(
            participation.Id,
            participation.Type,
            participation.BankQuizId,
            participation.TeacherQuizId,
            participation.QuizName,
            participation.HomeworkId,
            participation.HomeworkTitle,
            participation.ChildId,
            dbContext.Users.Where(user => user.Id == participation.ChildId).Select(user => user.DisplayName).FirstOrDefault(),
            participation.ReviewerId,
            participation.ClassId,
            participation.Score,
            participation.ScorePercent,
            participation.CorrectCount,
            participation.WrongCount,
            participation.PendingReviewCount,
            participation.StartedOn,
            participation.EndedOn,
            participation.ValidationStatus));

    // What a reviewer still has to do: no verdict yet, or answers still unmarked.
    public static IQueryable<Participation> AwaitingReview(this IQueryable<Participation> participations)
        => participations.Where(participation => participation.ValidationStatus == null || participation.PendingReviewCount > 0);
}
