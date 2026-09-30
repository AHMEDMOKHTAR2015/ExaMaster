namespace QuizMaster.Domain.Shared.Enums;

// Values match the app's QUESTION_TYPE (questionTypeId).
public enum QuestionType
{
    Choose = 1,       // options + one correct option; graded by the app
    Complete = 2,     // fill-in-the-blank passage; graded by a teacher (a blank can have several right answers)
    RightWrong = 3,   // a two-option Choose question with the fixed Right/Wrong pair; graded by the app
    Explain = 4,      // open rich-text response; graded by a teacher, carries an authored share of the quiz score
}
