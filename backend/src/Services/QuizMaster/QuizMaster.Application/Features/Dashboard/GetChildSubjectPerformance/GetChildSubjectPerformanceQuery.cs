using QuizMaster.Application.Features.Dashboard.GetMySubjectPerformance;

namespace QuizMaster.Application.Features.Dashboard.GetChildSubjectPerformance;

// A parent's view of one child's standing in each subject: the same donuts the child sees on their own dashboard
// (dbo.GetStudentSubjectPerformance), read through the parent's link to the child.
public record GetChildSubjectPerformanceQuery(int ChildId) : IQuery<IReadOnlyList<SubjectPerformanceDto>>;
