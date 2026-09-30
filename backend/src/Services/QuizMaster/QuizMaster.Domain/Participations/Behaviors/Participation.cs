namespace QuizMaster.Domain.Participations;

public partial class Participation
{
    // How far back a claimed start may sit before it stops being believed.
    public static readonly TimeSpan MaxAttemptAge = TimeSpan.FromHours(12);

    public const int MaxFeedbackLength = MaxLength.C2048;

    // Grading happens here, on the server, so the answer key never reaches a student before their attempt is recorded.
    public static Participation Submit(
        User student, AttemptedQuiz quiz, HomeworkAssignment? homework, Participation? latestAttemptAtHomework,
        IReadOnlyCollection<QuestionResponse> responses, DateTime? claimedStartedOn, IQuizMasterAction action)
    {
        // Any active member may take a practice quiz, as in the app; an assignment additionally checks it was set for them.
        if (!student.IsActive)
            throw new DomainException("This account is deactivated.");

        if (homework is not null)
        {
            homework.EnsureOpenFor(student);

            //insight - without this a student could submit a throwaway attempt to read the correct answers back, then
            // submit again with them. A teacher rejecting the latest attempt is the one deliberate way to reopen it.
            if (latestAttemptAtHomework is not null && !latestAttemptAtHomework.IsRejected)
                throw new DomainException("You have already submitted this assignment.");
        }

        // requiredAll is a guarantee, not a client-side nudge: only the server can make it binding.
        if (quiz.Settings.RequiredAll && !QuizGrader.IsFullyAnswered(quiz.Questions, responses))
            throw new DomainException("All questions must be answered before submitting.");

        var grade = QuizGrader.Grade(quiz.Questions, responses);

        // Trust the client's start only within a sane window; the end is always the server's.
        var endedOn = action.CreatedOn;
        var startedOn = claimedStartedOn is { } claimed && claimed <= endedOn && endedOn - claimed <= MaxAttemptAge
            ? claimed
            : endedOn;

        var participation = new Participation
        {
            Type = homework is null ? ParticipationType.Quiz : ParticipationType.Homework,
            BankQuizId = quiz.BankQuizId,
            TeacherQuizId = quiz.TeacherQuizId,
            QuizName = quiz.Name,
            HomeworkId = homework?.Id,
            HomeworkTitle = homework?.Title,
            ChildId = student.Id,
            ParentId = student.ParentId,
            ReviewerId = homework?.CreatedById ?? quiz.ReviewerId,
            StageId = student.StageId,
            GradeId = student.GradeId,
            ClassId = student.ClassId,
            Score = grade.Score,
            ScorePercent = grade.ScorePercent,
            CorrectCount = grade.CorrectCount,
            WrongCount = grade.WrongCount,
            PendingReviewCount = grade.PendingReviewCount,
            StartedOn = startedOn,
            EndedOn = endedOn,
            CreatedById = action.CreatedById,
            CreatedOn = action.CreatedOn
        };
        participation._answers.AddRange(grade.Answers.Select(ParticipationAnswer.From));

        participation.AddDomainEvent(new QuizSubmitted(participation, action));
        return participation;
    }

    // Marks and verdict are saved as one action: a teacher cannot approve a submission and leave it unscored.
    public void Review(IReadOnlyCollection<ReviewMark> marks, ValidationStatus status, string? feedback, IQuizMasterAction action)
    {
        if (!Enum.IsDefined(status))
            throw new DomainException("Unknown validation status.");
        if (feedback?.Length > MaxFeedbackLength)
            throw new DomainException($"Feedback cannot exceed {MaxFeedbackLength} characters.");
        if (marks.Select(mark => mark.QuestionId).Distinct().Count() != marks.Count)
            throw new DomainException("Each question can be marked only once.");

        foreach (var mark in marks)
        {
            var answer = _answers.SingleOrDefault(a => a.QuestionId == mark.QuestionId)
                ?? throw new DomainException($"Question {mark.QuestionId} is not part of this submission.");
            answer.Mark(mark.AwardedPercent, mark.Comment, action);
        }

        ScorePercent = QuizScoring.RoundPercent(QuizScoring.SumEarnedPercent(_answers.Select(answer => answer.EarnedPercent)));
        PendingReviewCount = _answers.Count(answer => answer.RequiresReview && !answer.IsMarked);

        var trimmedFeedback = string.IsNullOrWhiteSpace(feedback) ? null : feedback.Trim();
        var verdictChanged = ValidationStatus != status || ValidationFeedback != trimmedFeedback;

        ValidationStatus = status;
        ValidationFeedback = trimmedFeedback;
        ValidatedById = action.CreatedById;
        ValidatedOn = action.CreatedOn;
        (LastModifiedById, LastModifiedOn) = (action.CreatedById, action.CreatedOn);

        AddDomainEvent(new SubmissionReviewed(this, verdictChanged, action));
    }

    // Whether the student (or their parent) may see the correct answers yet.
    public bool AreResultsAvailableTo(HomeworkAssignment? homework, DateTime now)
        => homework is null || homework.AreResultsAvailableAt(now);
}
