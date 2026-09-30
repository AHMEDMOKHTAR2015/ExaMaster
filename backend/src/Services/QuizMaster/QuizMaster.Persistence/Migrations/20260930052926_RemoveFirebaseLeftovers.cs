using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace QuizMaster.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class RemoveFirebaseLeftovers : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ImportedRecord");

            migrationBuilder.RenameColumn(
                name: "FirebaseUid",
                table: "User",
                newName: "SignInUid");

            migrationBuilder.RenameIndex(
                name: "IX_User_FirebaseUid",
                table: "User",
                newName: "IX_User_SignInUid");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "SignInUid",
                table: "User",
                newName: "FirebaseUid");

            migrationBuilder.RenameIndex(
                name: "IX_User_SignInUid",
                table: "User",
                newName: "IX_User_FirebaseUid");

            migrationBuilder.CreateTable(
                name: "ImportedRecord",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Collection = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    ImportedOn = table.Column<DateTime>(type: "datetime2", nullable: false),
                    SourceId = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: false, collation: "Latin1_General_100_BIN2"),
                    TargetId = table.Column<int>(type: "int", nullable: false),
                    TenantId = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ImportedRecord", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ImportedRecord_TenantId_Collection_SourceId",
                table: "ImportedRecord",
                columns: new[] { "TenantId", "Collection", "SourceId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ImportedRecord_TenantId_Collection_TargetId",
                table: "ImportedRecord",
                columns: new[] { "TenantId", "Collection", "TargetId" });
        }
    }
}
