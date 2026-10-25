using QuizMaster.Application.Features.TeachingMaterials.Shared;

namespace QuizMaster.Application.Features.TeachingMaterials.CreateTeachingMaterial;

public class CreateTeachingMaterialCommandHandler(
    TeachingMaterialRepository _teachingMaterialRepository, SubjectRepository _subjectRepository, Repository<Grade> _gradeRepository,
    QuizMasterDbContext _dbContext)
    : IRequestHandler<CreateTeachingMaterialCommand, IdResponse>
{
    public async Task<IdResponse> Handle(CreateTeachingMaterialCommand command, CancellationToken ct)
    {
        var subject = await _subjectRepository.LoadOrThrowAsync(command.SubjectId, ct);
        var grade = await _gradeRepository.LoadOrThrowAsync(command.GradeId, ct);
        var uploader = await _dbContext.FindTeacherRecordAsync(command.CreatedById, ct)
            ?? throw new ForbiddenException("Your account is not linked to a teacher record, so you cannot upload material yet. Ask the school administrator to link it.");

        // the validator has read the same document and found nothing wrong with its shape
        var draft = MaterialDocument.Read(command.Document).Draft!;

        if (await _teachingMaterialRepository.ExistsAsync(material => material.CreatedById == command.CreatedById
                && material.SubjectId == subject.Id && material.GradeId == grade.Id && material.SourceKey == draft.SourceKey.Trim(), ct))
            throw new ConflictException($"You already uploaded \"{draft.Title}\" for {subject.Name}, {grade.Name}. Delete it first to upload it again.");

        var material = TeachingMaterial.Create(draft, subject, grade, uploader, command);

        await _teachingMaterialRepository.AddAsync(material, ct);
        await _teachingMaterialRepository.SaveChangesAsync(ct);

        return new IdResponse(material.Id);
    }
}
