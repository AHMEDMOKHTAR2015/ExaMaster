namespace QuizMaster.Application.Features.Academic.ListSubjects;

// Reference data: readable by every member of the organization.
public record ListSubjectsQuery(string? Search = null) : IQuery<ListSubjectsResponse>;
public record ListSubjectsResponse(IReadOnlyList<SubjectDto> Subjects);

public class ListSubjectsQueryValidator : AbstractValidator<ListSubjectsQuery>
{
    public ListSubjectsQueryValidator()
        => RuleFor(q => q.Search).MaximumLengthWithMessage(MaxLength.C128, nameof(ListSubjectsQuery.Search));
}
