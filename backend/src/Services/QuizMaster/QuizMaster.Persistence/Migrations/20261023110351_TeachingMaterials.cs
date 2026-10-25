using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace QuizMaster.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class TeachingMaterials : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "TeachingMaterial",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    TenantId = table.Column<int>(type: "int", nullable: false),
                    SourceKey = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: false),
                    Title = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: false),
                    Subtitle = table.Column<string>(type: "nvarchar(512)", maxLength: 512, nullable: true),
                    ForLabel = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: true),
                    SubjectId = table.Column<int>(type: "int", nullable: false),
                    GradeId = table.Column<int>(type: "int", nullable: false),
                    Semester = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: true),
                    TeacherId = table.Column<int>(type: "int", nullable: false),
                    OverviewJson = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    CreatedById = table.Column<int>(type: "int", nullable: false),
                    CreatedOn = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETUTCDATE()"),
                    LastModifiedById = table.Column<int>(type: "int", nullable: true),
                    LastModifiedOn = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TeachingMaterial", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TeachingMaterial_Grade_GradeId",
                        column: x => x.GradeId,
                        principalTable: "Grade",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_TeachingMaterial_Subject_SubjectId",
                        column: x => x.SubjectId,
                        principalTable: "Subject",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "MaterialUnit",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    TeachingMaterialId = table.Column<int>(type: "int", nullable: false),
                    Number = table.Column<int>(type: "int", nullable: false),
                    Kind = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    Title = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: false),
                    BookPageFrom = table.Column<int>(type: "int", nullable: true),
                    BookPageTo = table.Column<int>(type: "int", nullable: true),
                    BigIdeaEnglish = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    BigIdeaArabic = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    KeyTakeaways = table.Column<string>(type: "nvarchar(max)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MaterialUnit", x => x.Id);
                    table.ForeignKey(
                        name: "FK_MaterialUnit_TeachingMaterial_TeachingMaterialId",
                        column: x => x.TeachingMaterialId,
                        principalTable: "TeachingMaterial",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "MaterialLesson",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    MaterialUnitId = table.Column<int>(type: "int", nullable: false),
                    Order = table.Column<int>(type: "int", nullable: false),
                    Code = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    Title = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: false),
                    ContentJson = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    ArabicExplanationJson = table.Column<string>(type: "nvarchar(max)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MaterialLesson", x => x.Id);
                    table.ForeignKey(
                        name: "FK_MaterialLesson_MaterialUnit_MaterialUnitId",
                        column: x => x.MaterialUnitId,
                        principalTable: "MaterialUnit",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_MaterialLesson_MaterialUnitId_Order",
                table: "MaterialLesson",
                columns: new[] { "MaterialUnitId", "Order" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_MaterialUnit_TeachingMaterialId_Number",
                table: "MaterialUnit",
                columns: new[] { "TeachingMaterialId", "Number" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_TeachingMaterial_GradeId",
                table: "TeachingMaterial",
                column: "GradeId");

            migrationBuilder.CreateIndex(
                name: "IX_TeachingMaterial_SubjectId",
                table: "TeachingMaterial",
                column: "SubjectId");

            migrationBuilder.CreateIndex(
                name: "IX_TeachingMaterial_TenantId",
                table: "TeachingMaterial",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_TeachingMaterial_TenantId_CreatedById_SubjectId_GradeId_SourceKey",
                table: "TeachingMaterial",
                columns: new[] { "TenantId", "CreatedById", "SubjectId", "GradeId", "SourceKey" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_TeachingMaterial_TenantId_TeacherId",
                table: "TeachingMaterial",
                columns: new[] { "TenantId", "TeacherId" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "MaterialLesson");

            migrationBuilder.DropTable(
                name: "MaterialUnit");

            migrationBuilder.DropTable(
                name: "TeachingMaterial");
        }
    }
}
