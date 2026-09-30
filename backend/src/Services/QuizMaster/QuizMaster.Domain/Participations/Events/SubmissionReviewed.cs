namespace QuizMaster.Domain.Participations.Events;

// VerdictChanged: re-saving an already reviewed submission (e.g. reworded feedback) should not notify the student twice.
public record SubmissionReviewed(Participation Participation, bool VerdictChanged, IQuizMasterAction Action) : DomainEvent(Action);
