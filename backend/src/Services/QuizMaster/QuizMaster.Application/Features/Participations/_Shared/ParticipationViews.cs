namespace QuizMaster.Application.Features.Participations.Shared;

public static class ParticipationViews
{
    public static ParticipationDto ToDto(Participation participation, bool resultsAvailable, bool marksAvailable)
        => participation.Adapt<ParticipationDto>() with
        {
            ResultsAvailable = resultsAvailable,
            MarksAvailable = marksAvailable,
            Answers = participation.Answers.OrderBy(answer => answer.Position).Select(answer => ToDto(answer, resultsAvailable, marksAvailable)).ToList()
        };

    //insight - before an assignment is due, a student sees their verdicts but not the correct answers: the persisted record
    // always keeps the full detail (a teacher grading needs it); only what is SENT is redacted, by the domain's own rule.
    // While the assignment waits on a revision, the verdicts and marks go too.
    public static ParticipationAnswerDto ToDto(ParticipationAnswer answer, bool resultsAvailable, bool marksAvailable)
    {
        var dto = answer.Adapt<ParticipationAnswerDto>();
        if (resultsAvailable)
            return dto;

        var redacted = marksAvailable ? QuizGrader.Redact(answer.ToGradedAnswer()) : QuizGrader.RedactMarks(answer.ToGradedAnswer());
        dto = dto with
        {
            CorrectOptionId = redacted.CorrectOptionId,
            CorrectOptionText = redacted.CorrectOptionText,
            ReferenceAnswer = redacted.ReferenceAnswer,
            Blanks = redacted.Blanks
        };
        return marksAvailable
            ? dto
            : dto with { IsCorrect = redacted.IsCorrect, EarnedPercent = redacted.EarnedPercent, SuggestedAward = null, ManualGrade = null };
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
            participation.ValidationStatus,
            dbContext.Assignments.Where(assignment => assignment.Id == participation.HomeworkId).Select(assignment => (AssignmentKind?)assignment.Kind).FirstOrDefault()));

    // What a reviewer still has to do: no verdict yet, or answers still unmarked.
    public static IQueryable<Participation> AwaitingReview(this IQueryable<Participation> participations)
        => participations.Where(participation => participation.ValidationStatus == null || participation.PendingReviewCount > 0);
}
