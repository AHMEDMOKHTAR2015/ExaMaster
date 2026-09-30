using Blocks.Domain;

namespace QuizMasterPro.Abstractions;

public abstract record DomainEvent<TAction>(TAction Action) : IDomainEvent
    where TAction : IAggregateAction;
