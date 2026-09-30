namespace QuizMaster.Application.Features.Users.LinkParent;

public class LinkParentCommandHandler(Repository<User> _userRepository, Repository<RegistrationKey> _keyRepository)
    : IRequestHandler<LinkParentCommand, IdResponse>
{
    public async Task<IdResponse> Handle(LinkParentCommand command, CancellationToken ct)
    {
        var student = await _userRepository.GetByIdOrThrowAsync(command.AggregateId, ct);
        var parent = await _userRepository.LoadOrThrowAsync(command.ParentId, ct);

        //insight - a child's slot follows the child (the app's user trigger did the same): the family they leave gets it
        // back, the family they join is charged, and the child now holds that family's key. Moving into a family whose
        // allowance is spent is refused, as enrolling a new child there would be.
        if (student.ParentId != parent.Id)
        {
            var oldKey = student.RegistrationKeyId is { } oldKeyId ? await _keyRepository.GetByIdAsync(oldKeyId, ct) : null;
            var newKey = parent.RegistrationKeyId is { } newKeyId ? await _keyRepository.GetByIdAsync(newKeyId, ct) : null;

            if (oldKey?.Id != newKey?.Id)
            {
                newKey?.SpendChildSlot(parent.Id, command.CreatedOn, command);
                oldKey?.ReleaseChildSlot(command);
            }

            if (newKey is not null)
                student.HoldRegistrationKey(newKey, command);
            else if (oldKey is not null)
                student.ReleaseRegistrationKey(command);
        }

        student.LinkToParent(parent, command);
        await _userRepository.SaveChangesAsync(ct);             // the link and both counts, in one commit

        return new IdResponse(student.Id);
    }
}
