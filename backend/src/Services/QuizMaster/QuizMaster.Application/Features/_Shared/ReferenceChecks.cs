namespace QuizMaster.Application.Features.Shared;

// Loading the aggregates a command names by id. The tenant query filter applies, so an id from another
// organization is "not found" exactly like an id that never existed.
public static class ReferenceChecks
{
    public static async Task<TEntity> LoadOrThrowAsync<TEntity>(this Repository<TEntity> repository, int id, CancellationToken ct)
        where TEntity : class, IEntity<int>
        => await repository.GetByIdAsync(id, ct) ?? throw new BadRequestException($"{typeof(TEntity).Name} {id} does not exist.");

    public static async Task<TEntity?> LoadIfSetAsync<TEntity>(this Repository<TEntity> repository, int? id, CancellationToken ct)
        where TEntity : class, IEntity<int>
        => id is { } value ? await repository.LoadOrThrowAsync(value, ct) : null;

    public static async Task<List<TEntity>> LoadAllOrThrowAsync<TEntity>(this Repository<TEntity> repository, IReadOnlyCollection<int>? ids, CancellationToken ct)
        where TEntity : class, IEntity<int>
    {
        if (ids is null || ids.Count == 0)
            return [];

        var loaded = await repository.GetByIdsAsync(ids, ct);
        var missing = ids.Distinct().Except(loaded.Select(e => e.Id)).ToList();
        if (missing.Count > 0)
            throw new BadRequestException($"{typeof(TEntity).Name} {string.Join(", ", missing)} does not exist.");
        return loaded;
    }

    public static async Task EnsureExistsAsync<TEntity>(this Repository<TEntity> repository, int? id, CancellationToken ct)
        where TEntity : class, IEntity<int>
    {
        if (id is { } value && !await repository.ExistsAsync(value, ct))
            throw new BadRequestException($"{typeof(TEntity).Name} {value} does not exist.");
    }
}
