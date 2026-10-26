namespace QuizMaster.Domain.TeachingRooms;

// A student who asked to join a teaching room, and the teacher's answer. Created only through TeachingRoom.
public class TeachingRoomMember : Entity
{
    private TeachingRoomMember() {}

    public int TeachingRoomId { get; private set; }
    public int StudentId { get; private set; }                   // the student's user id
    public TeachingRoomMemberStatus Status { get; private set; }
    public DateTime RequestedOn { get; private set; }
    public int? DecidedById { get; private set; }
    public DateTime? DecidedOn { get; private set; }

    public bool IsApproved => Status == TeachingRoomMemberStatus.Approved;

    internal static TeachingRoomMember Request(int studentId, IQuizMasterAction action) => new()
    {
        StudentId = studentId,
        Status = TeachingRoomMemberStatus.Pending,
        RequestedOn = action.CreatedOn
    };

    internal void Decide(TeachingRoomMemberStatus status, IQuizMasterAction action)
    {
        Status = status;
        DecidedById = action.CreatedById;
        DecidedOn = action.CreatedOn;
    }
}
