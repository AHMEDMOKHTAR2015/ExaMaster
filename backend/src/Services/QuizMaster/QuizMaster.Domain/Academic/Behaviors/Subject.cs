namespace QuizMaster.Domain.Academic;

public partial class Subject
{
    public static Subject Create(string name, string? color, IQuizMasterAction action)
    {
        var subject = new Subject { CreatedById = action.CreatedById, CreatedOn = action.CreatedOn };
        subject.Apply(name, color);
        return subject;
    }

    public void Update(string name, string? color, IQuizMasterAction action)
    {
        Apply(name, color);
        (LastModifiedById, LastModifiedOn) = (action.CreatedById, action.CreatedOn);
    }

    private void Apply(string name, string? color)
    {
        if (!string.IsNullOrWhiteSpace(color) && !AcademicRules.HexColor.IsMatch(color.Trim()))
            throw new DomainException("A subject colour must be written as #RRGGBB.");

        (Name, Color) = (AcademicRules.RequiredName(name), string.IsNullOrWhiteSpace(color) ? null : color.Trim());
    }
}
