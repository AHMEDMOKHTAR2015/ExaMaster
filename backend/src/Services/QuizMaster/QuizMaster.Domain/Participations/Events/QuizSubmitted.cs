namespace QuizMaster.Domain.Participations.Events;

public record QuizSubmitted(Participation Participation, IQuizMasterAction Action) : DomainEvent(Action);
