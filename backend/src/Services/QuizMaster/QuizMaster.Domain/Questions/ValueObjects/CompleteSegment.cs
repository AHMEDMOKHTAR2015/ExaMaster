namespace QuizMaster.Domain.Questions;

public enum CompleteSegmentKind
{
    Text,
    Blank,
}

// One piece of a Complete passage: static text, or a blank the student fills in.
// A blank's ExpectedLength reveals the keyword's length only (to size the textbox), never its content,
// so segments are safe to send to a student before submission.
public sealed record CompleteSegment(CompleteSegmentKind Kind, string? Text = null, int? Index = null, int? ExpectedLength = null)
{
    public static CompleteSegment ForText(string text) => new(CompleteSegmentKind.Text, Text: text);
    public static CompleteSegment ForBlank(int index, int expectedLength) => new(CompleteSegmentKind.Blank, Index: index, ExpectedLength: expectedLength);

    public bool IsBlank => Kind == CompleteSegmentKind.Blank;
}
