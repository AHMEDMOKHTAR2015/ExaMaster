namespace QuizMaster.Domain.Shared;

public abstract record DomainEvent(IQuizMasterAction Action) : DomainEvent<IQuizMasterAction>(Action);
