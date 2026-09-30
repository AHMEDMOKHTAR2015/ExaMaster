namespace QuizMaster.Application.Features.Academic.UpdateSubject;

public class UpdateSubjectCommandHandler(Repository<Subject> _subjectRepository)
    : IRequestHandler<UpdateSubjectCommand, IdResponse>
{
    public async Task<IdResponse> Handle(UpdateSubjectCommand command, CancellationToken ct)
    {
        var subject = await _subjectRepository.GetByIdOrThrowAsync(command.AggregateId, ct);
        subject.Update(command.Name, command.Color, command);

        await _subjectRepository.SaveChangesAsync(ct);

        return new IdResponse(subject.Id);
    }
}
