namespace QuizMaster.Domain.Academic;

public partial class Teacher
{
    public static Teacher Create(string firstName, string lastName, string? email, string? photoUrl, IReadOnlyCollection<Subject> subjects, IQuizMasterAction action)
    {
        var teacher = new Teacher { CreatedById = action.CreatedById, CreatedOn = action.CreatedOn };
        teacher.Apply(firstName, lastName, email, photoUrl, subjects);
        return teacher;
    }

    public void Update(string firstName, string lastName, string? email, string? photoUrl, IReadOnlyCollection<Subject> subjects, IQuizMasterAction action)
    {
        Apply(firstName, lastName, email, photoUrl, subjects);
        (LastModifiedById, LastModifiedOn) = (action.CreatedById, action.CreatedOn);
    }

    // A subject being deleted leaves no id behind (see ClassGroup.Drop).
    public void Drop(Subject subject, IQuizMasterAction action)
    {
        SubjectIds = SubjectIds.Where(id => id != subject.Id).ToList();
        (LastModifiedById, LastModifiedOn) = (action.CreatedById, action.CreatedOn);
    }

    private void Apply(string firstName, string lastName, string? email, string? photoUrl, IReadOnlyCollection<Subject> subjects)
    {
        if (!string.IsNullOrWhiteSpace(email) && !AcademicRules.Email.IsMatch(email.Trim()))
            throw new DomainException("Invalid email format.");

        FirstName = AcademicRules.RequiredName(firstName);
        LastName = AcademicRules.RequiredName(lastName);
        Email = string.IsNullOrWhiteSpace(email) ? null : email.Trim().ToLowerInvariant();
        PhotoUrl = string.IsNullOrWhiteSpace(photoUrl) ? null : photoUrl.Trim();
        SubjectIds = subjects.Select(subject => subject.Id).Distinct().Order().ToList();
    }
}
