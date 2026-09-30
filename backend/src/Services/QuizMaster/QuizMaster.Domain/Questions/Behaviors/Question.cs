namespace QuizMaster.Domain.Questions;

public partial class Question
{
    public static Question Create(AuthoredQuestion authored, QuestionClassification classification, IQuizMasterAction action)
    {
        var question = new Question { CreatedById = action.CreatedById, CreatedOn = action.CreatedOn };
        question.Apply(authored, classification);
        return question;
    }

    // The question and its answer are always written together, so they can never diverge.
    public void Update(AuthoredQuestion authored, QuestionClassification classification, IQuizMasterAction action)
    {
        Apply(authored, classification);
        (LastModifiedById, LastModifiedOn) = (action.CreatedById, action.CreatedOn);
    }

    // Where the question sits in the bank (subject, stage, grade, semester), leaving its content and answer as they are.
    public void Reclassify(QuestionClassification classification, IQuizMasterAction action)
    {
        (SubjectId, StageId, GradeId, Semester) = (classification.SubjectId, classification.StageId, classification.GradeId, classification.Semester);
        (LastModifiedById, LastModifiedOn) = (action.CreatedById, action.CreatedOn);
    }

    private void Apply(AuthoredQuestion authored, QuestionClassification classification)
    {
        Type = authored.Type;
        Name = authored.Name;
        Options = authored.Options;
        Segments = authored.Segments;
        SubjectHtml = authored.SubjectHtml;
        WeightPercent = authored.WeightPercent;
        DurationSeconds = authored.DurationSeconds;

        CorrectOptionId = authored.Key.CorrectOptionId;
        CorrectBlanks = authored.Key.CorrectBlanks;
        ReferenceAnswer = authored.Key.ReferenceAnswer;

        (SubjectId, StageId, GradeId, Semester) = (classification.SubjectId, classification.StageId, classification.GradeId, classification.Semester);
    }
}
