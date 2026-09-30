using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace QuizMaster.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class RegistrationKeys : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "RegistrationKeyId",
                table: "User",
                type: "int",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "RegistrationKey",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    TenantId = table.Column<int>(type: "int", nullable: false),
                    Code = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    Role = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    ExpiresOn = table.Column<DateTime>(type: "datetime2", nullable: true),
                    ParentId = table.Column<int>(type: "int", nullable: true),
                    ClaimedOn = table.Column<DateTime>(type: "datetime2", nullable: true),
                    MaxChildren = table.Column<int>(type: "int", nullable: true),
                    ChildCount = table.Column<int>(type: "int", nullable: false),
                    RowVersion = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: true),
                    CreatedById = table.Column<int>(type: "int", nullable: false),
                    CreatedOn = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETUTCDATE()"),
                    LastModifiedById = table.Column<int>(type: "int", nullable: true),
                    LastModifiedOn = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RegistrationKey", x => x.Id);
                    table.ForeignKey(
                        name: "FK_RegistrationKey_User_ParentId",
                        column: x => x.ParentId,
                        principalTable: "User",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_User_RegistrationKeyId",
                table: "User",
                column: "RegistrationKeyId");

            migrationBuilder.CreateIndex(
                name: "IX_RegistrationKey_Code",
                table: "RegistrationKey",
                column: "Code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_RegistrationKey_ParentId",
                table: "RegistrationKey",
                column: "ParentId");

            migrationBuilder.CreateIndex(
                name: "IX_RegistrationKey_TenantId",
                table: "RegistrationKey",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_RegistrationKey_TenantId_ParentId",
                table: "RegistrationKey",
                columns: new[] { "TenantId", "ParentId" });

            migrationBuilder.AddForeignKey(
                name: "FK_User_RegistrationKey_RegistrationKeyId",
                table: "User",
                column: "RegistrationKeyId",
                principalTable: "RegistrationKey",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_User_RegistrationKey_RegistrationKeyId",
                table: "User");

            migrationBuilder.DropTable(
                name: "RegistrationKey");

            migrationBuilder.DropIndex(
                name: "IX_User_RegistrationKeyId",
                table: "User");

            migrationBuilder.DropColumn(
                name: "RegistrationKeyId",
                table: "User");
        }
    }
}
