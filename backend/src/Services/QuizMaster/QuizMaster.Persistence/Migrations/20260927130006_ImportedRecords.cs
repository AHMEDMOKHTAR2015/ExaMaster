using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace QuizMaster.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ImportedRecords : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ImportedRecord",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    TenantId = table.Column<int>(type: "int", nullable: false),
                    Collection = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    SourceId = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: false, collation: "Latin1_General_100_BIN2"),
                    TargetId = table.Column<int>(type: "int", nullable: false),
                    ImportedOn = table.Column<DateTime>(type: "datetime2", nullable: false)
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

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ImportedRecord");
        }
    }
}
