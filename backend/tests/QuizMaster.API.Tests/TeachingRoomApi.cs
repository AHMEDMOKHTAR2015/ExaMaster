using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http.Connections;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.SignalR.Client;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.DependencyInjection;
using QuizMaster.API.Realtime;
using QuizMaster.Persistence;
using QuizMasterPro.Security;
using Testcontainers.MsSql;

namespace QuizMaster.API.Tests;

// The whole API in memory (migrations, auth, claims transformation, tenant filter, hubs), against a real SQL Server in a
// throwaway container: persistence is never mocked. One school with a teacher presenting a three-lesson material to class
// A, and a second school, are seeded once; every test opens rooms of its own, so tests never share a room.
public sealed class TeachingRoomApi : WebApplicationFactory<Program>, IAsyncLifetime
{
    public static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web) { Converters = { new JsonStringEnumConverter() } };

    private readonly MsSqlContainer _sql = new MsSqlBuilder("mcr.microsoft.com/mssql/server:2022-latest").Build();

    public SeededSchool School { get; private set; } = null!;

    public async Task InitializeAsync()
    {
        await _sql.StartAsync();
        _ = Server;                                               // starts the host: migrates the empty database
        School = await SeededSchool.SeedAsync(Services);
    }

    async Task IAsyncLifetime.DisposeAsync()
    {
        await DisposeAsync();
        await _sql.DisposeAsync();
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        var database = new SqlConnectionStringBuilder(_sql.GetConnectionString()) { InitialCatalog = "QuizMasterTests" };
        builder.UseEnvironment("Development");                    // the local signing keys of appsettings.Development.json
        builder.UseSetting("ConnectionStrings:Database", database.ConnectionString);
        builder.UseSetting("SeedOptions:DemoSchool", "false");
    }

    public string TokenFor(string uid) => Services.GetRequiredService<AccessTokenIssuer>().Issue(uid, DateTime.UtcNow).Token;

    public HttpClient ClientFor(string uid)
    {
        var client = CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", TokenFor(uid));
        return client;
    }

    // A live connection to the teaching-room hub, over the transport given, recording everything the server sends it.
    public async Task<BoardClient> ConnectAsync(string uid, HttpTransportType transport = HttpTransportType.WebSockets)
    {
        var token = TokenFor(uid);
        var connection = new HubConnectionBuilder()
            .WithUrl(new Uri(Server.BaseAddress, TeachingRoomHub.Path.TrimStart('/')), options =>
            {
                options.Transports = transport;
                options.AccessTokenProvider = () => Task.FromResult<string?>(token);
                options.HttpMessageHandlerFactory = _ => Server.CreateHandler();
                options.WebSocketFactory = async (context, ct) =>
                {
                    var client = Server.CreateWebSocketClient();
                    client.ConfigureRequest = request => request.Headers.Authorization = $"Bearer {token}";
                    return await client.ConnectAsync(context.Uri, ct);
                };
            })
            .AddJsonProtocol(options => options.PayloadSerializerOptions.Converters.Add(new JsonStringEnumConverter()))
            .Build();

        var board = new BoardClient(connection);
        await connection.StartAsync();
        return board;
    }

    // ---- the teacher's HTTP calls ----

    public async Task<int> OpenRoomAsync(string teacherUid = SeededSchool.TeacherUid)
    {
        var response = await ClientFor(teacherUid).PostAsJsonAsync("/api/teaching-rooms", new { teachingMaterialId = School.MaterialId });
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<IdResponseBody>(Json))!.Id;
    }

    public async Task<HttpResponseMessage> RequestToJoinAsync(string studentUid, int roomId)
        => await ClientFor(studentUid).PostAsync($"/api/teaching-rooms/{roomId}/join-requests", null);

    public async Task<HttpResponseMessage> DecideAsync(int roomId, string studentUid, string decision, string teacherUid = SeededSchool.TeacherUid)
        => await ClientFor(teacherUid).PostAsync($"/api/teaching-rooms/{roomId}/members/{School.UserId(studentUid)}:{decision}", null);

    public async Task<HttpResponseMessage> MoveAsync(int roomId, string direction, string teacherUid = SeededSchool.TeacherUid)
        => await ClientFor(teacherUid).PostAsync($"/api/teaching-rooms/{roomId}:{direction}", null);

    // A room with these students admitted (and nobody else asked).
    public async Task<int> OpenRoomWithAsync(params string[] approvedStudentUids)
    {
        var roomId = await OpenRoomAsync();
        foreach (var uid in approvedStudentUids)
        {
            (await RequestToJoinAsync(uid, roomId)).EnsureSuccessStatusCode();
            (await DecideAsync(roomId, uid, "approve")).EnsureSuccessStatusCode();
        }
        return roomId;
    }

    public sealed record IdResponseBody(int Id);
}

[CollectionDefinition(Name)]
public sealed class TeachingRoomCollection : ICollectionFixture<TeachingRoomApi>
{
    public const string Name = "Teaching rooms (API + SQL Server)";
}

// The people and the material every teaching-room test works with.
public sealed class SeededSchool
{
    public const string TeacherUid = "room-teacher";
    public const string OtherTeacherUid = "room-teacher-2";      // teaches the subject too, but not class A, and did not upload the material
    public const string ParentUid = "room-parent";
    public const string StudentUid = "room-student-1";           // class A: the material reaches them
    public const string ClassmateUid = "room-student-2";
    public const string ThirdStudentUid = "room-student-3";
    public const string FourthStudentUid = "room-student-4";
    public const string OutsiderUid = "room-outsider";           // class B: another teacher's class, the material does not reach it
    public const string ForeignStudentUid = "foreign-student";   // another school altogether

    private readonly Dictionary<string, int> _userIds;

    private SeededSchool(Dictionary<string, int> userIds, int materialId) => (_userIds, MaterialId) = (userIds, materialId);

    public int MaterialId { get; }

    public int UserId(string uid) => _userIds[uid];

    // Outside any request there is no caller tenant: every row names its tenant, as DevelopmentDataSeeder does.
    public static async Task<SeededSchool> SeedAsync(IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<QuizMasterDbContext>();
        var system = new SystemAction(QuizMasterActionType.Seed, DateTime.UtcNow);

        var school = Tenant.Create("room-school", "Room School", TenantPlan.Trial, system);
        var otherSchool = Tenant.Create("other-school", "Other School", TenantPlan.Trial, system);
        db.Tenants.AddRange(school, otherSchool);
        await db.SaveChangesAsync();

        T In<T>(Tenant tenant, T entity) where T : IMultitenancy
        {
            entity.TenantId = tenant.Id;
            return entity;
        }
        User Person(Tenant tenant, string uid, UserRoleType role) => In(tenant, User.Create(tenant.Id, uid, $"{uid}@school.test", uid, [role], system));

        var teacher = Person(school, TeacherUid, UserRoleType.TEACHER);
        var otherTeacher = Person(school, OtherTeacherUid, UserRoleType.TEACHER);
        var students = new[] { StudentUid, ClassmateUid, ThirdStudentUid, FourthStudentUid }.Select(uid => Person(school, uid, UserRoleType.STUDENT)).ToList();
        var outsider = Person(school, OutsiderUid, UserRoleType.STUDENT);
        var foreignStudent = Person(otherSchool, ForeignStudentUid, UserRoleType.STUDENT);
        List<User> people = [teacher, otherTeacher, Person(school, ParentUid, UserRoleType.PARENT), outsider, foreignStudent, .. students];
        db.Users.AddRange(people);

        var programming = In(school, Subject.Create("Programming", null, [], system));
        var stage = In(school, Stage.Create("Secondary", 1, system));
        db.AddRange(programming, stage);
        await db.SaveChangesAsync();

        var grade = In(school, Grade.Create(stage, "First year", 1, system));
        var roster = In(school, Teacher.Create("Room", "Teacher", teacher.Email, null, [programming], system));
        var otherRoster = In(school, Teacher.Create("Other", "Teacher", otherTeacher.Email, null, [programming], system));
        db.AddRange(grade, roster, otherRoster);
        await db.SaveChangesAsync();

        var classA = In(school, ClassGroup.Create(grade, "A", [roster], [programming], system));
        var classB = In(school, ClassGroup.Create(grade, "B", [otherRoster], [programming], system));
        db.AddRange(classA, classB);
        await db.SaveChangesAsync();

        teacher.LinkToTeacherRecord(roster, system);
        otherTeacher.LinkToTeacherRecord(otherRoster, system);
        students.ForEach(student => student.PlaceInClass(classA, system));
        outsider.PlaceInClass(classB, system);

        // three items across a unit boundary: 1-1, 1-2 (closes unit 1), 2-1 (closes unit 2)
        static MaterialLessonDraft Lesson(int order, string code)
            => new(order, code, $"Lesson {code}", $$"""[{"type":"paragraph","text":"Lesson {{code}}"}]""", """{"title":"الشرح","items":[]}""");
        var draft = new MaterialDraft("room-material", "Programming and AI", null, null, Semester.First, "{}",
        [
            new(1, "Chapter", "Basics", null, null, "Big idea", "الفكرة", ["Takeaway one"], [Lesson(1, "1-1"), Lesson(2, "1-2")]),
            new(2, "Chapter", "More", null, null, "Big idea", "الفكرة", ["Takeaway two"], [Lesson(1, "2-1")])
        ]);
        var material = In(school, TeachingMaterial.Create(draft, programming, grade, roster, new SystemAction(QuizMasterActionType.Seed, DateTime.UtcNow) { CreatedById = teacher.Id }));
        db.TeachingMaterials.Add(material);
        await db.SaveChangesAsync();

        return new SeededSchool(people.ToDictionary(person => person.SignInUid, person => person.Id), material.Id);
    }
}
