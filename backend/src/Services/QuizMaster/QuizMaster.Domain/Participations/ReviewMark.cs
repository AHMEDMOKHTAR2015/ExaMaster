namespace QuizMaster.Domain.Participations;

// A teacher's mark for one reviewed answer: a share of the quiz between 0 and the answer's weight.
public sealed record ReviewMark(int QuestionId, double AwardedPercent, string? Comment = null);
