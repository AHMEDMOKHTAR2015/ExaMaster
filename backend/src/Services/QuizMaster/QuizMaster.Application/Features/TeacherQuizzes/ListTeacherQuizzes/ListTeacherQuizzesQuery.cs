namespace QuizMaster.Application.Features.TeacherQuizzes.ListTeacherQuizzes;

// Staff only: enumerating teacher quizzes would otherwise hand every teacher's bank to anyone.
public record ListTeacherQuizzesQuery(bool Mine = false, int? SubjectId = null, int? StageId = null) : IQuery<ListTeacherQuizzesResponse>;
public record ListTeacherQuizzesResponse(IReadOnlyList<TeacherQuizSummaryDto> Quizzes);
