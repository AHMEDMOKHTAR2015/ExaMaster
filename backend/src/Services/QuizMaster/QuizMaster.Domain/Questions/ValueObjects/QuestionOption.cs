namespace QuizMaster.Domain.Questions;

// One answer choice. Deliberately carries no "is correct" flag: the correct option lives only in the AnswerKey.
public sealed record QuestionOption(int Id, string Name);
