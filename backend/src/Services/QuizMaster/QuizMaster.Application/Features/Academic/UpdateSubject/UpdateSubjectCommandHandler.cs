namespace QuizMaster.Application.Features.Academic.UpdateSubject;

public class UpdateSubjectCommandHandler(SubjectRepository _subjectRepository, Repository<Question> _questionRepository, TeacherQuizRepository _teacherQuizRepository)
    : IRequestHandler<UpdateSubjectCommand, IdResponse>
{
    public async Task<IdResponse> Handle(UpdateSubjectCommand command, CancellationToken ct)
    {
        var subject = await _subjectRepository.GetByIdOrThrowAsync(command.AggregateId, ct);

        var tagIdsBefore = subject.Tags.Select(tag => tag.Id).ToList();
        subject.Update(command.Name, command.Color, command.Tags, command);
        var removedTagIds = tagIdsBefore.Except(subject.Tags.Select(tag => tag.Id)).ToList();

        // the questions carrying a removed tag drop it in the same commit (their tag lists are JSON, with no foreign key)
        if (removedTagIds.Count > 0)
        {
            foreach (var question in await _questionRepository.Query()
                         .Where(e => e.SubjectId == subject.Id && e.TagIds.Any(id => removedTagIds.Contains(id))).ToListAsync(ct))
                question.Untag(removedTagIds, command);
            foreach (var quiz in await _teacherQuizRepository.Query()
                         .Where(e => e.SubjectId == subject.Id && e.Questions.Any(q => q.TagIds.Any(id => removedTagIds.Contains(id)))).ToListAsync(ct))
                quiz.Untag(removedTagIds, command);
        }

        await _subjectRepository.SaveChangesAsync(ct);

        return new IdResponse(subject.Id);
    }
}
