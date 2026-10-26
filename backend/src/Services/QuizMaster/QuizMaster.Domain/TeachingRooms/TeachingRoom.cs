namespace QuizMaster.Domain.TeachingRooms;

// A live board a teacher presents one of their teaching materials on: students of the classes the material reaches ask to
// join, the teacher admits or turns them away, and every admitted screen follows the item the teacher is on.
// The teacher who opened it (CreatedById) is the only one who decides who joins and which item is shown.
public partial class TeachingRoom : AggregateRoot, IMultitenancy
{
    private TeachingRoom() {}                                    // use TeachingRoom.Open(...)

    public int TenantId { get; set; }

    public int TeachingMaterialId { get; private set; }
    public int SubjectId { get; private set; }                   // the material's: the subject the room is for

    //insight - the items are the material's lessons in reading order (units by number, lessons by order). A material
    // cannot be edited once uploaded, so its lesson count is the room's for good
    public int ItemCount { get; private set; }
    public int CurrentPosition { get; private set; }             // 1..ItemCount

    // Raised by every move, so a screen that receives two states out of order keeps the newer one.
    public int Revision { get; private set; }

    private readonly List<TeachingRoomMember> _members = new();
    public IReadOnlyList<TeachingRoomMember> Members => _members.AsReadOnly();

    public bool CanGoPrevious => CurrentPosition > 1;
    public bool CanGoNext => CurrentPosition < ItemCount;
}
