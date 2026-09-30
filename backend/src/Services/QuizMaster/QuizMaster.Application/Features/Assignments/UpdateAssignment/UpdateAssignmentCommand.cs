using QuizMaster.Application.Features.Assignments.Shared;

namespace QuizMaster.Application.Features.Assignments.UpdateAssignment;

// Only its author (or an administrator) may change it. IsActive false closes it to further submissions.
public record UpdateAssignmentCommand(
    string Title,
    AssignmentKind Kind,
    QuizSource Source,
    int QuizId,
    int ClassId,
    int? SubjectId,
    Semester? Semester,
    DateTimeOffset DueAt,
    bool IsActive,
    List<int>? AssignedChildIds) : QuizMasterCommand, IAssignmentInput
{
    public override QuizMasterActionType ActionType => QuizMasterActionType.UpdateAssignment;
}

public class UpdateAssignmentCommandValidator : QuizMasterCommandValidator<UpdateAssignmentCommand>
{
    public UpdateAssignmentCommandValidator() => this.AddAssignmentRules();
}
