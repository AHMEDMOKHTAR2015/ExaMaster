namespace QuizMaster.Application.Features.AccessRequests.RejectAccessRequest;

// The reason is shown to the visitor when they try to sign in with the password they chose, so it is written for them.
public record RejectAccessRequestCommand(string? Reason = null) : QuizMasterCommand
{
    public override QuizMasterActionType ActionType => QuizMasterActionType.RejectAccessRequest;
}

public class RejectAccessRequestCommandValidator : QuizMasterCommandValidator<RejectAccessRequestCommand>
{
    public RejectAccessRequestCommandValidator()
    {
        RuleFor(c => c.Reason).MaximumLengthWithMessage(MaxLength.C1024, nameof(RejectAccessRequestCommand.Reason));
    }
}

public class RejectAccessRequestCommandHandler(Repository<AccessRequest> _requestRepository)
    : IRequestHandler<RejectAccessRequestCommand, IdResponse>
{
    public async Task<IdResponse> Handle(RejectAccessRequestCommand command, CancellationToken ct)
    {
        var request = await _requestRepository.GetByIdOrThrowAsync(command.AggregateId, ct);
        request.Reject(command.Reason, command);
        await _requestRepository.SaveChangesAsync(ct);
        return new IdResponse(request.Id);
    }
}
