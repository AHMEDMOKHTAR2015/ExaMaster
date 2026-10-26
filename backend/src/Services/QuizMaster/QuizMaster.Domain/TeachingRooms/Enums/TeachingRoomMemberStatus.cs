namespace QuizMaster.Domain.TeachingRooms;

public enum TeachingRoomMemberStatus
{
    Pending = 1,      // asked to join; sees nothing of the board until the teacher admits them
    Approved = 2,     // follows the board live
    Rejected = 3,     // turned away, or removed after being admitted; the teacher can still admit them later
}
