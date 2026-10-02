namespace QuizMaster.Application.Features.Questions.RetagQuestions;

public class RetagQuestionsCommandHandler(Repository<Question> _questionRepository, SubjectRepository _subjectRepository)
    : IRequestHandler<RetagQuestionsCommand, RetagQuestionsResponse>
{
    public async Task<RetagQuestionsResponse> Handle(RetagQuestionsCommand command, CancellationToken ct)
    {
        var added = QuestionTags.None;
        if (command.AddTagIds is { Count: > 0 } addTagIds)
        {
            var owners = await _subjectRepository.GetOwnersOfTagsAsync(addTagIds, ct);
            added = owners.Count switch
            {
                0 => throw new BadRequestException($"Tag {string.Join(", ", addTagIds.Distinct())} does not exist."),
                1 => owners[0].TagsFor(addTagIds),
                _ => throw new BadRequestException("The tags to add must all come from one subject.")
            };
        }

        var questions = await _questionRepository.GetByIdsAsync(command.QuestionIds, ct);
        foreach (var question in questions)
            question.Retag(added, command.RemoveTagIds ?? [], command);

        await _questionRepository.SaveChangesAsync(ct);
        return new RetagQuestionsResponse(questions.Count);
    }
}
