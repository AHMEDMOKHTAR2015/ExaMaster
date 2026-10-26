namespace QuizMaster.Domain.TeachingRooms;

public partial class TeachingRoom
{
    // A teacher presents material they uploaded, for a subject still on their roster record. The board opens on its first item.
    public static TeachingRoom Open(TeachingMaterial material, Teacher presenter, IQuizMasterAction action)
    {
        if (!material.IsOwnedBy(action.CreatedById))
            throw new DomainException("You can only present material you uploaded.");
        if (!presenter.SubjectIds.Contains(material.SubjectId))
            throw new DomainException("You can only present material for a subject you teach.");
        if (material.LessonCount == 0)
            throw new DomainException("This material has no lessons to present.");

        return new TeachingRoom
        {
            TeachingMaterialId = material.Id,
            SubjectId = material.SubjectId,
            ItemCount = material.LessonCount,
            CurrentPosition = 1,
            Revision = 1,
            CreatedById = action.CreatedById,
            CreatedOn = action.CreatedOn
        };
    }

    public bool IsPresentedBy(int userId) => CreatedById == userId;

    public TeachingRoomMember? MemberFor(int studentId) => _members.SingleOrDefault(member => member.StudentId == studentId);

    // Whether the student was given the right to ask is the caller's check (the material reaching their class). Asking again
    // changes nothing: a pending request stays pending and a decision stands until the teacher changes it.
    public TeachingRoomMember RequestToJoin(int studentId, IQuizMasterAction action)
    {
        if (MemberFor(studentId) is { } existing)
            return existing;

        var member = TeachingRoomMember.Request(studentId, action);
        _members.Add(member);
        Touch(action);
        return member;
    }

    // Admits a waiting student, or one turned away earlier. Returns false when they were already admitted.
    public bool Approve(int studentId, IQuizMasterAction action)
        => Decide(studentId, TeachingRoomMemberStatus.Approved, action);

    // Turns a waiting student away, or removes an admitted one. Returns false when they were already turned away.
    public bool Reject(int studentId, IQuizMasterAction action)
        => Decide(studentId, TeachingRoomMemberStatus.Rejected, action);

    //insight - the ends are refused, never wrapped or clamped: a Next on the last item is a mistake the teacher should
    // hear about, and the position (and what every student sees) stays exactly where it was
    public void GoToNext(IQuizMasterAction action)
    {
        EnsurePresenter(action);
        if (!CanGoNext)
            throw new DomainException("This is the last item: there is no next one.");
        Move(+1, action);
    }

    public void GoToPrevious(IQuizMasterAction action)
    {
        EnsurePresenter(action);
        if (!CanGoPrevious)
            throw new DomainException("This is the first item: there is no previous one.");
        Move(-1, action);
    }

    private bool Decide(int studentId, TeachingRoomMemberStatus status, IQuizMasterAction action)
    {
        EnsurePresenter(action);
        var member = MemberFor(studentId)
            ?? throw new DomainException("That student has not asked to join this room.");
        if (member.Status == status)
            return false;

        member.Decide(status, action);
        Touch(action);
        return true;
    }

    private void Move(int step, IQuizMasterAction action)
    {
        CurrentPosition += step;
        Revision++;
        Touch(action);
    }

    // Behind the access checker, the aggregate still refuses anyone but the teacher who opened it.
    private void EnsurePresenter(IQuizMasterAction action)
    {
        if (!IsPresentedBy(action.CreatedById))
            throw new DomainException("Only the teacher presenting this room can do that.");
    }

    // Every change touches the room row, so its rowversion guards the members too (an approve racing a reject).
    private void Touch(IQuizMasterAction action)
        => (LastModifiedById, LastModifiedOn) = (action.CreatedById, action.CreatedOn);
}
