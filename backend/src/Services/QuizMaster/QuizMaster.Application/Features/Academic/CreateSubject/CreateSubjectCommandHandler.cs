namespace QuizMaster.Application.Features.Academic.CreateSubject;

public class CreateSubjectCommandHandler(Repository<Subject> _subjectRepository)
    : IRequestHandler<CreateSubjectCommand, IdResponse>
{
    public async Task<IdResponse> Handle(CreateSubjectCommand command, CancellationToken ct)
    {
        var subject = Subject.Create(command.Name, command.Color, command);

        await _subjectRepository.AddAsync(subject, ct);
        await _subjectRepository.SaveChangesAsync(ct);

        return new IdResponse(subject.Id);
    }
}
