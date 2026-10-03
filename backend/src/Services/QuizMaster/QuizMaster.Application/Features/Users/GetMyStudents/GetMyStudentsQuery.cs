namespace QuizMaster.Application.Features.Users.GetMyStudents;

// A teacher's students: the active students of every class the teacher teaches (ClassGroup.IsTaughtBy: assigned to it
// AND it studies one of their subjects). Worked out here from the caller's own teacher record, never from ids the
// client sends, so a teacher can only ever list their own students.
public record GetMyStudentsQuery : IQuery<GetMyStudentsResponse>;

public record GetMyStudentsResponse(IReadOnlyList<MyStudentDto> Students);

// Student: the account as every staff list shows it (GET /users returns the same record), so a teacher's screens build
// their roster from this rather than from every account in the school. The names are resolved for display.
// QuizCount / HomeworkCount: the student's submissions that belong to this teacher (in one of their subjects, or
// answering an assignment they set), by the kind the student sees (an assignment says what it is; no assignment is a quiz).
public record MyStudentDto(
    UserDto Student,
    string? ParentName,
    string? StageName,
    string? GradeName,
    string ClassName,
    int QuizCount,
    int HomeworkCount,
    DateTime? LastSubmittedOn);
