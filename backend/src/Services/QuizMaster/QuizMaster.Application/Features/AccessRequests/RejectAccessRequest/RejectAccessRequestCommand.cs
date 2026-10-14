using QuizMaster.Application.Realtime;
using Microsoft.Extensions.Logging;

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

public class RejectAccessRequestCommandHandler(
    Repository<AccessRequest> _requestRepository, IRealtimeNotifier _notifier, ILogger<RejectAccessRequestCommandHandler> _logger)
    : IRequestHandler<RejectAccessRequestCommand, IdResponse>
{
    public async Task<IdResponse> Handle(RejectAccessRequestCommand command, CancellationToken ct)
    {
        var request = await _requestRepository.GetByIdOrThrowAsync(command.AggregateId, ct);
        request.Reject(command.Reason, command);
        await _requestRepository.SaveChangesAsync(ct);
        await RealtimeSignals.AccessRequestsChangedSafelyAsync(_notifier, _logger, ct);
        return new IdResponse(request.Id);
    }
}
