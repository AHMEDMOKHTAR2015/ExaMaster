using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace QuizMaster.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Stage",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    TenantId = table.Column<int>(type: "int", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: false),
                    Order = table.Column<int>(type: "int", nullable: false),
                    CreatedById = table.Column<int>(type: "int", nullable: false),
                    CreatedOn = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETUTCDATE()"),
                    LastModifiedById = table.Column<int>(type: "int", nullable: true),
                    LastModifiedOn = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Stage", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Subject",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    TenantId = table.Column<int>(type: "int", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: false),
                    Color = table.Column<string>(type: "nvarchar(16)", maxLength: 16, nullable: true),
                    CreatedById = table.Column<int>(type: "int", nullable: false),
                    CreatedOn = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETUTCDATE()"),
                    LastModifiedById = table.Column<int>(type: "int", nullable: true),
                    LastModifiedOn = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Subject", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Teacher",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    TenantId = table.Column<int>(type: "int", nullable: false),
                    FirstName = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: false),
                    LastName = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: false),
                    Email = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: true),
                    PhotoUrl = table.Column<string>(type: "nvarchar(1024)", maxLength: 1024, nullable: true),
                    SubjectIds = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    CreatedById = table.Column<int>(type: "int", nullable: false),
                    CreatedOn = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETUTCDATE()"),
                    LastModifiedById = table.Column<int>(type: "int", nullable: true),
                    LastModifiedOn = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Teacher", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Tenant",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Slug = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    Name = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    Plan = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    LogoUrl = table.Column<string>(type: "nvarchar(1024)", maxLength: 1024, nullable: true),
                    PrimaryColor = table.Column<string>(type: "nvarchar(16)", maxLength: 16, nullable: true),
                    CreatedById = table.Column<int>(type: "int", nullable: false),
                    CreatedOn = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETUTCDATE()"),
                    LastModifiedById = table.Column<int>(type: "int", nullable: true),
                    LastModifiedOn = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Tenant", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Grade",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    TenantId = table.Column<int>(type: "int", nullable: false),
                    StageId = table.Column<int>(type: "int", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: false),
                    Order = table.Column<int>(type: "int", nullable: false),
                    CreatedById = table.Column<int>(type: "int", nullable: false),
                    CreatedOn = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETUTCDATE()"),
                    LastModifiedById = table.Column<int>(type: "int", nullable: true),
                    LastModifiedOn = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Grade", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Grade_Stage_StageId",
                        column: x => x.StageId,
                        principalTable: "Stage",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "TeacherQuiz",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    TenantId = table.Column<int>(type: "int", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(2048)", maxLength: 2048, nullable: false),
                    SubjectId = table.Column<int>(type: "int", nullable: false),
                    StageId = table.Column<int>(type: "int", nullable: true),
                    Semester = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: true),
                    Settings_AllowBack = table.Column<bool>(type: "bit", nullable: false),
                    Settings_AllowReview = table.Column<bool>(type: "bit", nullable: false),
                    Settings_AutoMove = table.Column<bool>(type: "bit", nullable: false),
                    Settings_DurationSeconds = table.Column<int>(type: "int", nullable: false),
                    Settings_ImagePath = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: true),
                    Settings_OneTimeJoin = table.Column<bool>(type: "bit", nullable: false),
                    Settings_PageSize = table.Column<int>(type: "int", nullable: false),
                    Settings_RequiredAll = table.Column<bool>(type: "bit", nullable: false),
                    Settings_RichText = table.Column<bool>(type: "bit", nullable: false),
                    Settings_ShowClock = table.Column<bool>(type: "bit", nullable: false),
                    Settings_ShowPager = table.Column<bool>(type: "bit", nullable: false),
                    Settings_ShuffleOptions = table.Column<bool>(type: "bit", nullable: false),
                    Settings_ShuffleQuestions = table.Column<bool>(type: "bit", nullable: false),
                    CreatedById = table.Column<int>(type: "int", nullable: false),
                    CreatedOn = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETUTCDATE()"),
                    LastModifiedById = table.Column<int>(type: "int", nullable: true),
                    LastModifiedOn = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TeacherQuiz", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TeacherQuiz_Stage_StageId",
                        column: x => x.StageId,
                        principalTable: "Stage",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_TeacherQuiz_Subject_SubjectId",
                        column: x => x.SubjectId,
                        principalTable: "Subject",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ClassGroup",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    TenantId = table.Column<int>(type: "int", nullable: false),
                    StageId = table.Column<int>(type: "int", nullable: false),
                    GradeId = table.Column<int>(type: "int", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: false),
                    TeacherIds = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    SubjectIds = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    CreatedById = table.Column<int>(type: "int", nullable: false),
                    CreatedOn = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETUTCDATE()"),
                    LastModifiedById = table.Column<int>(type: "int", nullable: true),
                    LastModifiedOn = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ClassGroup", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ClassGroup_Grade_GradeId",
                        column: x => x.GradeId,
                        principalTable: "Grade",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ClassGroup_Stage_StageId",
                        column: x => x.StageId,
                        principalTable: "Stage",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Question",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    TenantId = table.Column<int>(type: "int", nullable: false),
                    Type = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    Name = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Options = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Segments = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    SubjectHtml = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    WeightPercent = table.Column<double>(type: "float", nullable: true),
                    DurationSeconds = table.Column<int>(type: "int", nullable: true),
                    CorrectOptionId = table.Column<int>(type: "int", nullable: true),
                    CorrectBlanks = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ReferenceAnswer = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    SubjectId = table.Column<int>(type: "int", nullable: true),
                    StageId = table.Column<int>(type: "int", nullable: true),
                    GradeId = table.Column<int>(type: "int", nullable: true),
                    Semester = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: true),
                    CreatedById = table.Column<int>(type: "int", nullable: false),
                    CreatedOn = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETUTCDATE()"),
                    LastModifiedById = table.Column<int>(type: "int", nullable: true),
                    LastModifiedOn = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Question", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Question_Grade_GradeId",
                        column: x => x.GradeId,
                        principalTable: "Grade",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_Question_Stage_StageId",
                        column: x => x.StageId,
                        principalTable: "Stage",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_Question_Subject_SubjectId",
                        column: x => x.SubjectId,
                        principalTable: "Subject",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "TeacherQuizQuestion",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    TeacherQuizId = table.Column<int>(type: "int", nullable: false),
                    Number = table.Column<int>(type: "int", nullable: false),
                    Type = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    Name = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Options = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Segments = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    SubjectHtml = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    WeightPercent = table.Column<double>(type: "float", nullable: true),
                    DurationSeconds = table.Column<int>(type: "int", nullable: true),
                    CorrectOptionId = table.Column<int>(type: "int", nullable: true),
                    CorrectBlanks = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ReferenceAnswer = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TeacherQuizQuestion", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TeacherQuizQuestion_TeacherQuiz_TeacherQuizId",
                        column: x => x.TeacherQuizId,
                        principalTable: "TeacherQuiz",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "User",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    TenantId = table.Column<int>(type: "int", nullable: false),
                    FirebaseUid = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: false, collation: "Latin1_General_100_BIN2"),
                    Email = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: false),
                    DisplayName = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: false),
                    FirstName = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: true),
                    LastName = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: true),
                    MobileNumber = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: true),
                    PhotoUrl = table.Column<string>(type: "nvarchar(1024)", maxLength: 1024, nullable: true),
                    Roles = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    ParentId = table.Column<int>(type: "int", nullable: true),
                    TeacherId = table.Column<int>(type: "int", nullable: true),
                    StageId = table.Column<int>(type: "int", nullable: true),
                    GradeId = table.Column<int>(type: "int", nullable: true),
                    ClassId = table.Column<int>(type: "int", nullable: true),
                    CreatedById = table.Column<int>(type: "int", nullable: false),
                    CreatedOn = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETUTCDATE()"),
                    LastModifiedById = table.Column<int>(type: "int", nullable: true),
                    LastModifiedOn = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_User", x => x.Id);
                    table.ForeignKey(
                        name: "FK_User_ClassGroup_ClassId",
                        column: x => x.ClassId,
                        principalTable: "ClassGroup",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_User_Grade_GradeId",
                        column: x => x.GradeId,
                        principalTable: "Grade",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_User_Stage_StageId",
                        column: x => x.StageId,
                        principalTable: "Stage",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_User_Teacher_TeacherId",
                        column: x => x.TeacherId,
                        principalTable: "Teacher",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_User_User_ParentId",
                        column: x => x.ParentId,
                        principalTable: "User",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "BankQuiz",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    TenantId = table.Column<int>(type: "int", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(2048)", maxLength: 2048, nullable: false),
                    SubjectId = table.Column<int>(type: "int", nullable: true),
                    StageId = table.Column<int>(type: "int", nullable: true),
                    GradeId = table.Column<int>(type: "int", nullable: true),
                    ClassId = table.Column<int>(type: "int", nullable: true),
                    Semester = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: true),
                    ReviewerId = table.Column<int>(type: "int", nullable: true),
                    Settings_AllowBack = table.Column<bool>(type: "bit", nullable: false),
                    Settings_AllowReview = table.Column<bool>(type: "bit", nullable: false),
                    Settings_AutoMove = table.Column<bool>(type: "bit", nullable: false),
                    Settings_DurationSeconds = table.Column<int>(type: "int", nullable: false),
                    Settings_ImagePath = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: true),
                    Settings_OneTimeJoin = table.Column<bool>(type: "bit", nullable: false),
                    Settings_PageSize = table.Column<int>(type: "int", nullable: false),
                    Settings_RequiredAll = table.Column<bool>(type: "bit", nullable: false),
                    Settings_RichText = table.Column<bool>(type: "bit", nullable: false),
                    Settings_ShowClock = table.Column<bool>(type: "bit", nullable: false),
                    Settings_ShowPager = table.Column<bool>(type: "bit", nullable: false),
                    Settings_ShuffleOptions = table.Column<bool>(type: "bit", nullable: false),
                    Settings_ShuffleQuestions = table.Column<bool>(type: "bit", nullable: false),
                    CreatedById = table.Column<int>(type: "int", nullable: false),
                    CreatedOn = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETUTCDATE()"),
                    LastModifiedById = table.Column<int>(type: "int", nullable: true),
                    LastModifiedOn = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BankQuiz", x => x.Id);
                    table.ForeignKey(
                        name: "FK_BankQuiz_ClassGroup_ClassId",
                        column: x => x.ClassId,
                        principalTable: "ClassGroup",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_BankQuiz_Grade_GradeId",
                        column: x => x.GradeId,
                        principalTable: "Grade",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_BankQuiz_Stage_StageId",
                        column: x => x.StageId,
                        principalTable: "Stage",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_BankQuiz_Subject_SubjectId",
                        column: x => x.SubjectId,
                        principalTable: "Subject",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_BankQuiz_User_ReviewerId",
                        column: x => x.ReviewerId,
                        principalTable: "User",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "BankQuizQuestion",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    BankQuizId = table.Column<int>(type: "int", nullable: false),
                    QuestionId = table.Column<int>(type: "int", nullable: false),
                    Position = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BankQuizQuestion", x => x.Id);
                    table.ForeignKey(
                        name: "FK_BankQuizQuestion_BankQuiz_BankQuizId",
                        column: x => x.BankQuizId,
                        principalTable: "BankQuiz",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_BankQuizQuestion_Question_QuestionId",
                        column: x => x.QuestionId,
                        principalTable: "Question",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "HomeworkAssignment",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    TenantId = table.Column<int>(type: "int", nullable: false),
                    Title = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: false),
                    Kind = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    Source = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    BankQuizId = table.Column<int>(type: "int", nullable: true),
                    TeacherQuizId = table.Column<int>(type: "int", nullable: true),
                    StageId = table.Column<int>(type: "int", nullable: false),
                    GradeId = table.Column<int>(type: "int", nullable: true),
                    ClassId = table.Column<int>(type: "int", nullable: false),
                    SubjectId = table.Column<int>(type: "int", nullable: true),
                    Semester = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: true),
                    DueAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    AssignedChildIds = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    CreatedById = table.Column<int>(type: "int", nullable: false),
                    CreatedOn = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETUTCDATE()"),
                    LastModifiedById = table.Column<int>(type: "int", nullable: true),
                    LastModifiedOn = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_HomeworkAssignment", x => x.Id);
                    table.ForeignKey(
                        name: "FK_HomeworkAssignment_BankQuiz_BankQuizId",
                        column: x => x.BankQuizId,
                        principalTable: "BankQuiz",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_HomeworkAssignment_ClassGroup_ClassId",
                        column: x => x.ClassId,
                        principalTable: "ClassGroup",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_HomeworkAssignment_Grade_GradeId",
                        column: x => x.GradeId,
                        principalTable: "Grade",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_HomeworkAssignment_Stage_StageId",
                        column: x => x.StageId,
                        principalTable: "Stage",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_HomeworkAssignment_Subject_SubjectId",
                        column: x => x.SubjectId,
                        principalTable: "Subject",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_HomeworkAssignment_TeacherQuiz_TeacherQuizId",
                        column: x => x.TeacherQuizId,
                        principalTable: "TeacherQuiz",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Participation",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    TenantId = table.Column<int>(type: "int", nullable: false),
                    Type = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    BankQuizId = table.Column<int>(type: "int", nullable: true),
                    TeacherQuizId = table.Column<int>(type: "int", nullable: true),
                    QuizName = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: false),
                    HomeworkId = table.Column<int>(type: "int", nullable: true),
                    HomeworkTitle = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: true),
                    ChildId = table.Column<int>(type: "int", nullable: false),
                    ParentId = table.Column<int>(type: "int", nullable: true),
                    ReviewerId = table.Column<int>(type: "int", nullable: true),
                    StageId = table.Column<int>(type: "int", nullable: true),
                    GradeId = table.Column<int>(type: "int", nullable: true),
                    ClassId = table.Column<int>(type: "int", nullable: true),
                    Score = table.Column<int>(type: "int", nullable: false),
                    ScorePercent = table.Column<int>(type: "int", nullable: false),
                    CorrectCount = table.Column<int>(type: "int", nullable: false),
                    WrongCount = table.Column<int>(type: "int", nullable: false),
                    PendingReviewCount = table.Column<int>(type: "int", nullable: false),
                    StartedOn = table.Column<DateTime>(type: "datetime2", nullable: false),
                    EndedOn = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ValidationStatus = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: true),
                    ValidationFeedback = table.Column<string>(type: "nvarchar(2048)", maxLength: 2048, nullable: true),
                    ValidatedById = table.Column<int>(type: "int", nullable: true),
                    ValidatedOn = table.Column<DateTime>(type: "datetime2", nullable: true),
                    RowVersion = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: true),
                    CreatedById = table.Column<int>(type: "int", nullable: false),
                    CreatedOn = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETUTCDATE()"),
                    LastModifiedById = table.Column<int>(type: "int", nullable: true),
                    LastModifiedOn = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Participation", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Participation_BankQuiz_BankQuizId",
                        column: x => x.BankQuizId,
                        principalTable: "BankQuiz",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_Participation_HomeworkAssignment_HomeworkId",
                        column: x => x.HomeworkId,
                        principalTable: "HomeworkAssignment",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_Participation_TeacherQuiz_TeacherQuizId",
                        column: x => x.TeacherQuizId,
                        principalTable: "TeacherQuiz",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_Participation_User_ChildId",
                        column: x => x.ChildId,
                        principalTable: "User",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Participation_User_ParentId",
                        column: x => x.ParentId,
                        principalTable: "User",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_Participation_User_ReviewerId",
                        column: x => x.ReviewerId,
                        principalTable: "User",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "QuizAttemptLock",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    TenantId = table.Column<int>(type: "int", nullable: false),
                    ChildId = table.Column<int>(type: "int", nullable: false),
                    ScopeKey = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    BankQuizId = table.Column<int>(type: "int", nullable: true),
                    TeacherQuizId = table.Column<int>(type: "int", nullable: true),
                    HomeworkId = table.Column<int>(type: "int", nullable: true),
                    QuizName = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: false),
                    ReviewerId = table.Column<int>(type: "int", nullable: true),
                    ClassId = table.Column<int>(type: "int", nullable: true),
                    Status = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    StartedOn = table.Column<DateTime>(type: "datetime2", nullable: false),
                    LockedOn = table.Column<DateTime>(type: "datetime2", nullable: true),
                    ExitAttempts = table.Column<int>(type: "int", nullable: false),
                    LastExitReason = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: true),
                    ReleasedOn = table.Column<DateTime>(type: "datetime2", nullable: true),
                    ReleasedById = table.Column<int>(type: "int", nullable: true),
                    RowVersion = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: true),
                    CreatedById = table.Column<int>(type: "int", nullable: false),
                    CreatedOn = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETUTCDATE()"),
                    LastModifiedById = table.Column<int>(type: "int", nullable: true),
                    LastModifiedOn = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_QuizAttemptLock", x => x.Id);
                    table.ForeignKey(
                        name: "FK_QuizAttemptLock_BankQuiz_BankQuizId",
                        column: x => x.BankQuizId,
                        principalTable: "BankQuiz",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_QuizAttemptLock_HomeworkAssignment_HomeworkId",
                        column: x => x.HomeworkId,
                        principalTable: "HomeworkAssignment",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_QuizAttemptLock_TeacherQuiz_TeacherQuizId",
                        column: x => x.TeacherQuizId,
                        principalTable: "TeacherQuiz",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_QuizAttemptLock_User_ChildId",
                        column: x => x.ChildId,
                        principalTable: "User",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ParticipationAnswer",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ParticipationId = table.Column<int>(type: "int", nullable: false),
                    Position = table.Column<int>(type: "int", nullable: false),
                    QuestionId = table.Column<int>(type: "int", nullable: false),
                    QuestionName = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    SelectedOptionId = table.Column<int>(type: "int", nullable: true),
                    SelectedOptionText = table.Column<string>(type: "nvarchar(512)", maxLength: 512, nullable: true),
                    CorrectOptionId = table.Column<int>(type: "int", nullable: true),
                    CorrectOptionText = table.Column<string>(type: "nvarchar(512)", maxLength: 512, nullable: true),
                    IsCorrect = table.Column<bool>(type: "bit", nullable: false),
                    Blanks = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ResponseText = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ReferenceAnswer = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    WeightPercent = table.Column<double>(type: "float", nullable: false),
                    EarnedPercent = table.Column<double>(type: "float", nullable: true),
                    RequiresReview = table.Column<bool>(type: "bit", nullable: false),
                    AwardedPercent = table.Column<double>(type: "float", nullable: true),
                    GradeComment = table.Column<string>(type: "nvarchar(2048)", maxLength: 2048, nullable: true),
                    GradedById = table.Column<int>(type: "int", nullable: true),
                    GradedOn = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ParticipationAnswer", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ParticipationAnswer_Participation_ParticipationId",
                        column: x => x.ParticipationId,
                        principalTable: "Participation",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_BankQuiz_ClassId",
                table: "BankQuiz",
                column: "ClassId");

            migrationBuilder.CreateIndex(
                name: "IX_BankQuiz_GradeId",
                table: "BankQuiz",
                column: "GradeId");

            migrationBuilder.CreateIndex(
                name: "IX_BankQuiz_ReviewerId",
                table: "BankQuiz",
                column: "ReviewerId");

            migrationBuilder.CreateIndex(
                name: "IX_BankQuiz_StageId",
                table: "BankQuiz",
                column: "StageId");

            migrationBuilder.CreateIndex(
                name: "IX_BankQuiz_SubjectId",
                table: "BankQuiz",
                column: "SubjectId");

            migrationBuilder.CreateIndex(
                name: "IX_BankQuiz_TenantId",
                table: "BankQuiz",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_BankQuiz_TenantId_StageId",
                table: "BankQuiz",
                columns: new[] { "TenantId", "StageId" });

            migrationBuilder.CreateIndex(
                name: "IX_BankQuizQuestion_BankQuizId_Position",
                table: "BankQuizQuestion",
                columns: new[] { "BankQuizId", "Position" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_BankQuizQuestion_QuestionId",
                table: "BankQuizQuestion",
                column: "QuestionId");

            migrationBuilder.CreateIndex(
                name: "IX_ClassGroup_GradeId",
                table: "ClassGroup",
                column: "GradeId");

            migrationBuilder.CreateIndex(
                name: "IX_ClassGroup_StageId",
                table: "ClassGroup",
                column: "StageId");

            migrationBuilder.CreateIndex(
                name: "IX_ClassGroup_TenantId",
                table: "ClassGroup",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_Grade_StageId",
                table: "Grade",
                column: "StageId");

            migrationBuilder.CreateIndex(
                name: "IX_Grade_TenantId",
                table: "Grade",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_HomeworkAssignment_BankQuizId",
                table: "HomeworkAssignment",
                column: "BankQuizId");

            migrationBuilder.CreateIndex(
                name: "IX_HomeworkAssignment_ClassId",
                table: "HomeworkAssignment",
                column: "ClassId");

            migrationBuilder.CreateIndex(
                name: "IX_HomeworkAssignment_GradeId",
                table: "HomeworkAssignment",
                column: "GradeId");

            migrationBuilder.CreateIndex(
                name: "IX_HomeworkAssignment_StageId",
                table: "HomeworkAssignment",
                column: "StageId");

            migrationBuilder.CreateIndex(
                name: "IX_HomeworkAssignment_SubjectId",
                table: "HomeworkAssignment",
                column: "SubjectId");

            migrationBuilder.CreateIndex(
                name: "IX_HomeworkAssignment_TeacherQuizId",
                table: "HomeworkAssignment",
                column: "TeacherQuizId");

            migrationBuilder.CreateIndex(
                name: "IX_HomeworkAssignment_TenantId",
                table: "HomeworkAssignment",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_HomeworkAssignment_TenantId_ClassId_IsActive",
                table: "HomeworkAssignment",
                columns: new[] { "TenantId", "ClassId", "IsActive" });

            migrationBuilder.CreateIndex(
                name: "IX_HomeworkAssignment_TenantId_CreatedById",
                table: "HomeworkAssignment",
                columns: new[] { "TenantId", "CreatedById" });

            migrationBuilder.CreateIndex(
                name: "IX_HomeworkAssignment_TenantId_StageId_IsActive",
                table: "HomeworkAssignment",
                columns: new[] { "TenantId", "StageId", "IsActive" });

            migrationBuilder.CreateIndex(
                name: "IX_Participation_BankQuizId",
                table: "Participation",
                column: "BankQuizId");

            migrationBuilder.CreateIndex(
                name: "IX_Participation_ChildId",
                table: "Participation",
                column: "ChildId");

            migrationBuilder.CreateIndex(
                name: "IX_Participation_HomeworkId",
                table: "Participation",
                column: "HomeworkId");

            migrationBuilder.CreateIndex(
                name: "IX_Participation_ParentId",
                table: "Participation",
                column: "ParentId");

            migrationBuilder.CreateIndex(
                name: "IX_Participation_ReviewerId",
                table: "Participation",
                column: "ReviewerId");

            migrationBuilder.CreateIndex(
                name: "IX_Participation_TeacherQuizId",
                table: "Participation",
                column: "TeacherQuizId");

            migrationBuilder.CreateIndex(
                name: "IX_Participation_TenantId",
                table: "Participation",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_Participation_TenantId_ChildId_EndedOn",
                table: "Participation",
                columns: new[] { "TenantId", "ChildId", "EndedOn" });

            migrationBuilder.CreateIndex(
                name: "IX_Participation_TenantId_HomeworkId",
                table: "Participation",
                columns: new[] { "TenantId", "HomeworkId" });

            migrationBuilder.CreateIndex(
                name: "IX_Participation_TenantId_ReviewerId_PendingReviewCount",
                table: "Participation",
                columns: new[] { "TenantId", "ReviewerId", "PendingReviewCount" });

            migrationBuilder.CreateIndex(
                name: "IX_ParticipationAnswer_ParticipationId_Position",
                table: "ParticipationAnswer",
                columns: new[] { "ParticipationId", "Position" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Question_GradeId",
                table: "Question",
                column: "GradeId");

            migrationBuilder.CreateIndex(
                name: "IX_Question_StageId",
                table: "Question",
                column: "StageId");

            migrationBuilder.CreateIndex(
                name: "IX_Question_SubjectId",
                table: "Question",
                column: "SubjectId");

            migrationBuilder.CreateIndex(
                name: "IX_Question_TenantId",
                table: "Question",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_Question_TenantId_SubjectId_StageId",
                table: "Question",
                columns: new[] { "TenantId", "SubjectId", "StageId" });

            migrationBuilder.CreateIndex(
                name: "IX_QuizAttemptLock_BankQuizId",
                table: "QuizAttemptLock",
                column: "BankQuizId");

            migrationBuilder.CreateIndex(
                name: "IX_QuizAttemptLock_ChildId",
                table: "QuizAttemptLock",
                column: "ChildId");

            migrationBuilder.CreateIndex(
                name: "IX_QuizAttemptLock_HomeworkId",
                table: "QuizAttemptLock",
                column: "HomeworkId");

            migrationBuilder.CreateIndex(
                name: "IX_QuizAttemptLock_TeacherQuizId",
                table: "QuizAttemptLock",
                column: "TeacherQuizId");

            migrationBuilder.CreateIndex(
                name: "IX_QuizAttemptLock_TenantId",
                table: "QuizAttemptLock",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_QuizAttemptLock_TenantId_ChildId_ScopeKey",
                table: "QuizAttemptLock",
                columns: new[] { "TenantId", "ChildId", "ScopeKey" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_QuizAttemptLock_TenantId_HomeworkId",
                table: "QuizAttemptLock",
                columns: new[] { "TenantId", "HomeworkId" });

            migrationBuilder.CreateIndex(
                name: "IX_Stage_TenantId",
                table: "Stage",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_Subject_TenantId",
                table: "Subject",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_Teacher_TenantId",
                table: "Teacher",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_TeacherQuiz_StageId",
                table: "TeacherQuiz",
                column: "StageId");

            migrationBuilder.CreateIndex(
                name: "IX_TeacherQuiz_SubjectId",
                table: "TeacherQuiz",
                column: "SubjectId");

            migrationBuilder.CreateIndex(
                name: "IX_TeacherQuiz_TenantId",
                table: "TeacherQuiz",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_TeacherQuiz_TenantId_CreatedById",
                table: "TeacherQuiz",
                columns: new[] { "TenantId", "CreatedById" });

            migrationBuilder.CreateIndex(
                name: "IX_TeacherQuizQuestion_TeacherQuizId_Number",
                table: "TeacherQuizQuestion",
                columns: new[] { "TeacherQuizId", "Number" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Tenant_Slug",
                table: "Tenant",
                column: "Slug",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_User_ClassId",
                table: "User",
                column: "ClassId");

            migrationBuilder.CreateIndex(
                name: "IX_User_FirebaseUid",
                table: "User",
                column: "FirebaseUid",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_User_GradeId",
                table: "User",
                column: "GradeId");

            migrationBuilder.CreateIndex(
                name: "IX_User_ParentId",
                table: "User",
                column: "ParentId");

            migrationBuilder.CreateIndex(
                name: "IX_User_StageId",
                table: "User",
                column: "StageId");

            migrationBuilder.CreateIndex(
                name: "IX_User_TeacherId",
                table: "User",
                column: "TeacherId");

            migrationBuilder.CreateIndex(
                name: "IX_User_TenantId",
                table: "User",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_User_TenantId_ClassId",
                table: "User",
                columns: new[] { "TenantId", "ClassId" });

            migrationBuilder.CreateIndex(
                name: "IX_User_TenantId_ParentId",
                table: "User",
                columns: new[] { "TenantId", "ParentId" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "BankQuizQuestion");

            migrationBuilder.DropTable(
                name: "ParticipationAnswer");

            migrationBuilder.DropTable(
                name: "QuizAttemptLock");

            migrationBuilder.DropTable(
                name: "TeacherQuizQuestion");

            migrationBuilder.DropTable(
                name: "Tenant");

            migrationBuilder.DropTable(
                name: "Question");

            migrationBuilder.DropTable(
                name: "Participation");

            migrationBuilder.DropTable(
                name: "HomeworkAssignment");

            migrationBuilder.DropTable(
                name: "BankQuiz");

            migrationBuilder.DropTable(
                name: "TeacherQuiz");

            migrationBuilder.DropTable(
                name: "User");

            migrationBuilder.DropTable(
                name: "Subject");

            migrationBuilder.DropTable(
                name: "ClassGroup");

            migrationBuilder.DropTable(
                name: "Teacher");

            migrationBuilder.DropTable(
                name: "Grade");

            migrationBuilder.DropTable(
                name: "Stage");
        }
    }
}
