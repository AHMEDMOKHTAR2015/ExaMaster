namespace QuizMaster.Domain.Grading;

// What one student submitted for one question. Carries no verdict: the server decides that.
public sealed record QuestionResponse(
    int QuestionId,
    int? SelectedOptionId = null,              // Choose, Right or Wrong
    IReadOnlyList<BlankResponse>? Blanks = null,  // Complete
    string? ResponseText = null);              // Explain (rich HTML)

public sealed record BlankResponse(int Index, string? UserAnswer);
