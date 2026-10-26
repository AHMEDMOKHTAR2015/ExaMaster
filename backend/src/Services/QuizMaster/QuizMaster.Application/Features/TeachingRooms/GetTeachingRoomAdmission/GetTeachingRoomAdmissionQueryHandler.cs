using QuizMaster.Application.Features.TeachingRooms.Shared;

namespace QuizMaster.Application.Features.TeachingRooms.GetTeachingRoomAdmission;

public class GetTeachingRoomAdmissionQueryHandler(QuizMasterDbContext _dbContext, IClaimsProvider _claimsProvider)
    : IRequestHandler<GetTeachingRoomAdmissionQuery, GetTeachingRoomAdmissionResponse>
{
    public async Task<GetTeachingRoomAdmissionResponse> Handle(GetTeachingRoomAdmissionQuery query, CancellationToken ct)
    {
        var caller = Caller.From(_claimsProvider);
        return new GetTeachingRoomAdmissionResponse(await _dbContext.AdmissionAsync(query.Id, caller.UserId, caller.Roles, ct));
    }
}
