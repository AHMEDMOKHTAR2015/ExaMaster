using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace QuizMaster.Persistence.EntityConfigurations.Shared;

public static class JsonColumnExtensions
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter() }
    };

    // A small immutable value (a list of options, segments, blanks) stored whole as JSON in one nvarchar(max) column.
    // The comparer compares by content, so replacing a list with an equal one is not a change.
    public static PropertyBuilder<T> HasJsonConversion<T>(this PropertyBuilder<T> builder)
    {
        var converter = new ValueConverter<T, string>(
            value => JsonSerializer.Serialize(value, JsonOptions),
            json => JsonSerializer.Deserialize<T>(json, JsonOptions)!);

        var comparer = new ValueComparer<T>(
            (left, right) => JsonSerializer.Serialize(left, JsonOptions) == JsonSerializer.Serialize(right, JsonOptions),
            value => JsonSerializer.Serialize(value, JsonOptions).GetHashCode(),
            value => JsonSerializer.Deserialize<T>(JsonSerializer.Serialize(value, JsonOptions), JsonOptions)!);

        return builder.HasConversion(converter, comparer);
    }
}
