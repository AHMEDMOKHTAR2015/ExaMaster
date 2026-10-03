namespace QuizMaster.Application.Features.Academic.ListTeachers;

// Reference data: readable by every member of the organization.
public record ListTeachersQuery(int? SubjectId = null, string? Search = null) : IQuery<ListTeachersResponse>;
public record ListTeachersResponse(IReadOnlyList<TeacherDto> Teachers);

public class ListTeachersQueryValidator : AbstractValidator<ListTeachersQuery>
{
    public ListTeachersQueryValidator()
        => RuleFor(q => q.Search).MaximumLengthWithMessage(MaxLength.C128, nameof(ListTeachersQuery.Search));
}
