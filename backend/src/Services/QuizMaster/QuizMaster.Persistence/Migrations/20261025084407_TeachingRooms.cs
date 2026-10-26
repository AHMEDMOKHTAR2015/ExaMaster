using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace QuizMaster.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class TeachingRooms : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "TeachingRoom",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    TenantId = table.Column<int>(type: "int", nullable: false),
                    TeachingMaterialId = table.Column<int>(type: "int", nullable: false),
                    SubjectId = table.Column<int>(type: "int", nullable: false),
                    ItemCount = table.Column<int>(type: "int", nullable: false),
                    CurrentPosition = table.Column<int>(type: "int", nullable: false),
                    Revision = table.Column<int>(type: "int", nullable: false),
                    RowVersion = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: true),
                    CreatedById = table.Column<int>(type: "int", nullable: false),
                    CreatedOn = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETUTCDATE()"),
                    LastModifiedById = table.Column<int>(type: "int", nullable: true),
                    LastModifiedOn = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TeachingRoom", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TeachingRoom_Subject_SubjectId",
                        column: x => x.SubjectId,
                        principalTable: "Subject",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_TeachingRoom_TeachingMaterial_TeachingMaterialId",
                        column: x => x.TeachingMaterialId,
                        principalTable: "TeachingMaterial",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "TeachingRoomMember",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    TeachingRoomId = table.Column<int>(type: "int", nullable: false),
                    StudentId = table.Column<int>(type: "int", nullable: false),
                    Status = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    RequestedOn = table.Column<DateTime>(type: "datetime2", nullable: false),
                    DecidedById = table.Column<int>(type: "int", nullable: true),
                    DecidedOn = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TeachingRoomMember", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TeachingRoomMember_TeachingRoom_TeachingRoomId",
                        column: x => x.TeachingRoomId,
                        principalTable: "TeachingRoom",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_TeachingRoomMember_User_StudentId",
                        column: x => x.StudentId,
                        principalTable: "User",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_TeachingRoom_SubjectId",
                table: "TeachingRoom",
                column: "SubjectId");

            migrationBuilder.CreateIndex(
                name: "IX_TeachingRoom_TeachingMaterialId",
                table: "TeachingRoom",
                column: "TeachingMaterialId");

            migrationBuilder.CreateIndex(
                name: "IX_TeachingRoom_TenantId",
                table: "TeachingRoom",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_TeachingRoom_TenantId_CreatedById",
                table: "TeachingRoom",
                columns: new[] { "TenantId", "CreatedById" });

            migrationBuilder.CreateIndex(
                name: "IX_TeachingRoom_TenantId_TeachingMaterialId",
                table: "TeachingRoom",
                columns: new[] { "TenantId", "TeachingMaterialId" });

            migrationBuilder.CreateIndex(
                name: "IX_TeachingRoomMember_StudentId",
                table: "TeachingRoomMember",
                column: "StudentId");

            migrationBuilder.CreateIndex(
                name: "IX_TeachingRoomMember_TeachingRoomId_StudentId",
                table: "TeachingRoomMember",
                columns: new[] { "TeachingRoomId", "StudentId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "TeachingRoomMember");

            migrationBuilder.DropTable(
                name: "TeachingRoom");
        }
    }
}
