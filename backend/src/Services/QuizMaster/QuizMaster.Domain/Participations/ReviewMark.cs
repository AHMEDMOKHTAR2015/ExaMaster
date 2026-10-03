namespace QuizMaster.Domain.Participations;

// A teacher's mark for one reviewed answer: points between 0 and the answer's MaxAward (its share of the quiz, rounded).
public sealed record ReviewMark(int QuestionId, double AwardedPercent, string? Comment = null);
