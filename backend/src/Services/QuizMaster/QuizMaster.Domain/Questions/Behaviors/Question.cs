namespace QuizMaster.Domain.Questions;

public partial class Question
{
    public const int MaxTags = 20;

    public static Question Create(AuthoredQuestion authored, QuestionClassification classification, QuestionTags tags, IQuizMasterAction action)
    {
        var question = new Question { CreatedById = action.CreatedById, CreatedOn = action.CreatedOn };
        question.Apply(authored, classification, tags);
        return question;
    }

    // The question and its answer are always written together, so they can never diverge.
    public void Update(AuthoredQuestion authored, QuestionClassification classification, QuestionTags tags, IQuizMasterAction action)
    {
        Apply(authored, classification, tags);
        (LastModifiedById, LastModifiedOn) = (action.CreatedById, action.CreatedOn);
    }

    // Where the question sits in the bank (subject, stage, grade, semester), leaving its content and answer as they are.
    // Tags belong to a subject, so a question moved to another subject loses them.
    public void Reclassify(QuestionClassification classification, IQuizMasterAction action)
    {
        if (classification.SubjectId != SubjectId)
            TagIds = [];
        (SubjectId, StageId, GradeId, Semester) = (classification.SubjectId, classification.StageId, classification.GradeId, classification.Semester);
        (LastModifiedById, LastModifiedOn) = (action.CreatedById, action.CreatedOn);
    }

    // Replaces the question's tags, leaving everything else as it is.
    public void Tag(QuestionTags tags, IQuizMasterAction action)
    {
        ApplyTags(tags.TagIds, tags);
        (LastModifiedById, LastModifiedOn) = (action.CreatedById, action.CreatedOn);
    }

    // Adds and removes tags, keeping the others (an administrator's bulk action over many questions).
    public void Retag(QuestionTags added, IReadOnlyCollection<int> removedTagIds, IQuizMasterAction action)
    {
        ApplyTags(TagIds.Except(removedTagIds).Union(added.TagIds).ToList(), added);
        (LastModifiedById, LastModifiedOn) = (action.CreatedById, action.CreatedOn);
    }

    // The subject deleted these tags (or the subject itself): nothing in the database removes them from the JSON list.
    public void Untag(IReadOnlyCollection<int> tagIds, IQuizMasterAction action)
    {
        TagIds = TagIds.Except(tagIds).ToList();
        (LastModifiedById, LastModifiedOn) = (action.CreatedById, action.CreatedOn);
    }

    private void Apply(AuthoredQuestion authored, QuestionClassification classification, QuestionTags tags)
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
        ApplyTags(tags.TagIds, tags);
    }

    // `source` is where the newly given tags came from: it must be this question's own subject.
    private void ApplyTags(IReadOnlyList<int> tagIds, QuestionTags source)
    {
        if (!source.IsEmpty && source.SubjectId != SubjectId)
        {
            var question = Id == 0 ? "A question" : $"Question {Id}";
            throw new DomainException(SubjectId is null
                ? $"{question} has no subject, so it cannot be tagged."
                : $"{question} can only be tagged with its own subject's tags.");
        }
        if (tagIds.Count > MaxTags)
            throw new DomainException($"A question cannot have more than {MaxTags} tags.");

        TagIds = tagIds.Distinct().Order().ToList();
    }
}
