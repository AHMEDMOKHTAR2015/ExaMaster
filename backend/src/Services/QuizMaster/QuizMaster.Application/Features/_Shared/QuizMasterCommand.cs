namespace QuizMaster.Application.Features.Shared;

public abstract record QuizMasterCommand : AggregateCommandBase<QuizMasterActionType>, IQuizMasterAction, ICommand<IdResponse>;
public abstract record QuizMasterCommand<TResponse> : AggregateCommandBase<QuizMasterActionType>, IQuizMasterAction, ICommand<TResponse>;

// For commands addressed to an existing aggregate: its id comes from the route ({id}).
public abstract class QuizMasterCommandValidator<TCommand> : AbstractValidator<TCommand>
    where TCommand : IAggregateAction
{
    protected QuizMasterCommandValidator()
    {
        RuleFor(c => c.AggregateId).GreaterThan(0).WithMessageForInvalidId("id");
    }
}
