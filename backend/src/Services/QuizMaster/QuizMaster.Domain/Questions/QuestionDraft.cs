namespace QuizMaster.Domain.Questions;

// A question as an author submits it, before validation. Which members apply depends on Type:
//   Choose      Text, Options (texts, in display order), CorrectOption (1-based position of the correct one)
//   RightWrong  Text (the statement), IsRight
//   Complete    Text with "(Complete)" after each keyword: "The capital is Paris(Complete)."
//   Explain     SubjectHtml (the prompt), ReferenceAnswer (the model answer), WeightPercent (share of the quiz, 1–100)
// DurationSeconds (seconds on the clock for this question) applies to every type.
public sealed record QuestionDraft(
    QuestionType Type,
    string? Text = null,
    IReadOnlyList<string>? Options = null,
    int? CorrectOption = null,
    bool? IsRight = null,
    string? SubjectHtml = null,
    string? ReferenceAnswer = null,
    double? WeightPercent = null,
    int? DurationSeconds = null);
