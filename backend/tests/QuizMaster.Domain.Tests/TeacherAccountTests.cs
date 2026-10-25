using static QuizMaster.Domain.Tests.TestData;

namespace QuizMaster.Domain.Tests;

// A teacher account and its roster record are one person, shown by one name on the Users and Teachers lists.
public class TeacherAccountTests
{
    private static readonly TestAction ByAdmin = Action(QuizMasterActionType.UpdateTeacher, AdminId);

    private static QuizMaster.Domain.Academic.Teacher RosterTeacher(string firstName, string lastName)
        => QuizMaster.Domain.Academic.Teacher.Create(firstName, lastName, "ahmed@school.test", null, [], ByAdmin).WithId(7);

    [Fact]
    public void Linking_an_account_gives_it_the_roster_record_s_name()
    {
        var account = Teacher();

        account.LinkToTeacherRecord(RosterTeacher("Ahmed", "Mokhtar"), ByAdmin);

        Assert.Equal(7, account.TeacherId);
        Assert.Equal(("Ahmed", "Mokhtar", "Ahmed Mokhtar"), (account.FirstName, account.LastName, account.DisplayName));
    }

    [Fact]
    public void Renaming_the_roster_record_keeps_its_email_and_subjects()
    {
        var teacher = RosterTeacher("Ahmed", "Mokhtar");

        teacher.Rename(" Ahmed ", "Mokhtar Ali", ByAdmin);

        Assert.Equal(("Ahmed", "Mokhtar Ali", "ahmed@school.test"), (teacher.FirstName, teacher.LastName, teacher.Email));
    }

    [Fact]
    public void A_roster_record_cannot_lose_its_name()
        => Assert.Throws<DomainException>(() => RosterTeacher("Ahmed", "Mokhtar").Rename("Ahmed", " ", ByAdmin));
}
