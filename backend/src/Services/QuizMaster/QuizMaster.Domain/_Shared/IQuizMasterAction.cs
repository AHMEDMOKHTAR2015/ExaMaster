namespace QuizMaster.Domain.Shared;

// Every command is also an audit record (who, when, what, why); domain methods take it as a parameter.
public interface IQuizMasterAction : IAggregateAction<QuizMasterActionType>;
