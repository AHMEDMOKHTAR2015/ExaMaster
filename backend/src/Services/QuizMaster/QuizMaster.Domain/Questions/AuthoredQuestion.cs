namespace QuizMaster.Domain.Questions;

// A validated question: display content (safe for students) plus its AnswerKey (never sent before grading).
// The only way to author a question, shared by the bank and by teacher quizzes, so both obey the same rules.
public sealed record AuthoredQuestion(
    QuestionType Type,
    string Name,
    IReadOnlyList<QuestionOption> Options,
    IReadOnlyList<CompleteSegment> Segments,
    string? SubjectHtml,
    double? WeightPercent,
    int? DurationSeconds,
    AnswerKey Key)
{
    public const int MaxTextLength = 4096;
    public const int MaxOptionLength = 512;
    public const int MinOptions = 2;
    public const int MaxOptions = 10;
    public const int MinDurationSeconds = 5;
    public const int MaxDurationSeconds = 3600;

    // A whole quiz's worth: an invalid question is reported by its position ("Question 3: ...").
    public static IReadOnlyList<AuthoredQuestion> FromAll(IReadOnlyList<QuestionDraft> drafts)
    {
        var authored = new List<AuthoredQuestion>(drafts.Count);
        for (var i = 0; i < drafts.Count; i++)
        {
            try
            {
                authored.Add(From(drafts[i]));
            }
            catch (DomainException ex)
            {
                throw new DomainException($"Question {i + 1}: {ex.Message}", ex);
            }
        }
        return authored;
    }

    public static AuthoredQuestion From(QuestionDraft draft)
    {
        EnsureValidDuration(draft.DurationSeconds);

        return draft.Type switch
        {
            QuestionType.Choose => Choose(draft),
            QuestionType.RightWrong => RightWrong(draft),
            QuestionType.Complete => Complete(draft),
            QuestionType.Explain => Explain(draft),
            _ => throw new DomainException($"Unsupported question type '{draft.Type}'.")
        };
    }

    private static AuthoredQuestion Choose(QuestionDraft draft)
    {
        var text = RequiredText(draft.Text);
        var optionTexts = (draft.Options ?? []).Select(option => option?.Trim() ?? string.Empty).ToList();

        if (optionTexts.Count is < MinOptions or > MaxOptions)
            throw new DomainException($"A Choose question needs between {MinOptions} and {MaxOptions} options.");
        if (optionTexts.Any(string.IsNullOrEmpty))
            throw new DomainException("Options cannot be empty.");
        if (optionTexts.Any(option => option.Length > MaxOptionLength))
            throw new DomainException($"An option cannot exceed {MaxOptionLength} characters.");
        if (optionTexts.Distinct(StringComparer.OrdinalIgnoreCase).Count() != optionTexts.Count)
            throw new DomainException("Options must be different from each other.");
        if (draft.CorrectOption is not { } correct || correct < 1 || correct > optionTexts.Count)
            throw new DomainException("Choose which option is correct.");

        var options = optionTexts.Select((option, i) => new QuestionOption(i + 1, option)).ToList();
        return new AuthoredQuestion(QuestionType.Choose, text, options, [], null, null, draft.DurationSeconds,
            new AnswerKey(correct, null, null));
    }

    private static AuthoredQuestion RightWrong(QuestionDraft draft)
    {
        var text = RequiredText(draft.Text);
        if (draft.IsRight is not { } isRight)
            throw new DomainException("Say whether the statement is right or wrong.");

        return new AuthoredQuestion(QuestionType.RightWrong, text, RightWrongOptions.All, [], null, null, draft.DurationSeconds,
            new AnswerKey(RightWrongOptions.CorrectOptionId(isRight), null, null));
    }

    private static AuthoredQuestion Complete(QuestionDraft draft)
    {
        var text = RequiredText(draft.Text);
        var (segments, keywords) = CompletePassage.Parse(text);

        //insight - the stored name is the MASKED preview: every list and search prints it, so it must never carry the answer
        return new AuthoredQuestion(QuestionType.Complete, CompletePassage.RenderPreview(segments), [], segments, null, null,
            draft.DurationSeconds, new AnswerKey(null, keywords, null));
    }

    private static AuthoredQuestion Explain(QuestionDraft draft)
    {
        // stored HTML is clean HTML: whatever the editor (or a hand-made request) sent, scripts never reach the database
        draft = draft with { SubjectHtml = HtmlText.Clean(draft.SubjectHtml), ReferenceAnswer = HtmlText.Clean(draft.ReferenceAnswer) };

        if (!HtmlText.HasContent(draft.SubjectHtml))
            throw new DomainException("An Explain question needs a prompt.");
        if (!HtmlText.HasContent(draft.ReferenceAnswer))
            throw new DomainException("An Explain question needs a model answer.");
        if (draft.WeightPercent is not { } weight || !double.IsFinite(weight)
            || weight < QuizScoring.MinExplainWeightPercent || weight > QuizScoring.MaxExplainWeightPercent)
            throw new DomainException($"An Explain question's weight must be between {QuizScoring.MinExplainWeightPercent} and {QuizScoring.MaxExplainWeightPercent} percent.");
        if (HtmlText.ExceedsFieldLimit(draft.SubjectHtml) || HtmlText.ExceedsFieldLimit(draft.ReferenceAnswer))
            throw new DomainException($"The prompt and the model answer are limited to {HtmlText.MaxFieldBytes / 1024} KB each.");

        return new AuthoredQuestion(QuestionType.Explain, HtmlText.PlainText(draft.SubjectHtml), [], [], draft.SubjectHtml, weight,
            draft.DurationSeconds, new AnswerKey(null, null, draft.ReferenceAnswer));
    }

    private static string RequiredText(string? text)
    {
        var trimmed = text?.Trim();
        if (string.IsNullOrEmpty(trimmed))
            throw new DomainException("The question text is required.");
        if (trimmed.Length > MaxTextLength)
            throw new DomainException($"The question text cannot exceed {MaxTextLength} characters.");
        return trimmed;
    }

    private static void EnsureValidDuration(int? durationSeconds)
    {
        if (durationSeconds is { } seconds && (seconds < MinDurationSeconds || seconds > MaxDurationSeconds))
            throw new DomainException($"A question's time limit must be between {MinDurationSeconds} and {MaxDurationSeconds} seconds.");
    }
}
