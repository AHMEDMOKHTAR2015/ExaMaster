using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace QuizMaster.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class IdempotentSubmissions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "HomeworkAttempt",
                table: "Participation",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "SubmissionKey",
                table: "Participation",
                type: "uniqueidentifier",
                nullable: true);

            // Number the submissions already recorded, oldest first, before the unique index needs them to be numbered.
            migrationBuilder.Sql("""
                UPDATE [Participation]
                SET [HomeworkAttempt] = [Numbered].[Attempt]
                FROM [Participation]
                INNER JOIN (
                    SELECT [Id], ROW_NUMBER() OVER (PARTITION BY [TenantId], [ChildId], [HomeworkId] ORDER BY [EndedOn], [Id]) AS [Attempt]
                    FROM [Participation]
                    WHERE [HomeworkId] IS NOT NULL
                ) AS [Numbered] ON [Numbered].[Id] = [Participation].[Id];
                """);

            migrationBuilder.CreateIndex(
                name: "IX_Participation_TenantId_ChildId_HomeworkId_HomeworkAttempt",
                table: "Participation",
                columns: new[] { "TenantId", "ChildId", "HomeworkId", "HomeworkAttempt" },
                unique: true,
                filter: "[HomeworkId] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_Participation_TenantId_ChildId_SubmissionKey",
                table: "Participation",
                columns: new[] { "TenantId", "ChildId", "SubmissionKey" },
                unique: true,
                filter: "[SubmissionKey] IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Participation_TenantId_ChildId_HomeworkId_HomeworkAttempt",
                table: "Participation");

            migrationBuilder.DropIndex(
                name: "IX_Participation_TenantId_ChildId_SubmissionKey",
                table: "Participation");

            migrationBuilder.DropColumn(
                name: "HomeworkAttempt",
                table: "Participation");

            migrationBuilder.DropColumn(
                name: "SubmissionKey",
                table: "Participation");
        }
    }
}
