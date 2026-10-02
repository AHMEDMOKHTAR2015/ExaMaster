namespace QuizMaster.Domain.Academic;

// A topic inside a subject (Fractions, Photosynthesis, ...). Questions are tagged with their subject's tags, so a
// student's results can be read per topic: where they are strong and where they are weak.
public class SubjectTag : Entity
{
    private SubjectTag() {}

    public int SubjectId { get; private set; }                   // set by EF through the Subject.Tags relationship
    public string Name { get; private set; } = null!;

    internal static SubjectTag Create(string name) => new() { Name = name };

    internal void Rename(string name) => Name = name;
}

// A tag as an administrator edits it: with the Id of an existing tag (kept, possibly renamed), or without one (new).
public sealed record SubjectTagDraft(int? Id, string Name);
