namespace QuizMaster.Application.Dtos;

public record StageDto(int Id, string Name, int Order);

public record GradeDto(int Id, int StageId, string Name, int Order);

public record ClassGroupDto(int Id, int StageId, int GradeId, string Name, IReadOnlyList<int> TeacherIds, IReadOnlyList<int> SubjectIds);

public record SubjectDto(int Id, string Name, string? Color);

public record TeacherDto(int Id, string FirstName, string LastName, string? Email, string? PhotoUrl, IReadOnlyList<int> SubjectIds);
