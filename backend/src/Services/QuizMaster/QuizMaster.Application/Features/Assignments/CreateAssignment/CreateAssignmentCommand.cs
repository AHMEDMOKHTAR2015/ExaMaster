using QuizMaster.Application.Features.Assignments.Shared;

namespace QuizMaster.Application.Features.Assignments.CreateAssignment;

// Sets a quiz (Source Bank: a bank quiz id; Source Custom: a teacher quiz id) for a class, or for named students of it.
// The author reviews the submissions.
public record CreateAssignmentCommand(
    string Title,
    AssignmentKind Kind,
    QuizSource Source,
    int QuizId,
    int ClassId,
    int? SubjectId,
    Semester? Semester,
    DateTimeOffset DueAt,
    List<int>? AssignedChildIds) : QuizMasterCommand, IAssignmentInput
{
    public override QuizMasterActionType ActionType => QuizMasterActionType.CreateAssignment;
}

public class CreateAssignmentCommandValidator : AbstractValidator<CreateAssignmentCommand>
{
    public CreateAssignmentCommandValidator() => this.AddAssignmentRules();
}
