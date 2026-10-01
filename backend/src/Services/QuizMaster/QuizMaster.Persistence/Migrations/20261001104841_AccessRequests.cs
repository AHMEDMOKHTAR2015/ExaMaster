using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace QuizMaster.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AccessRequests : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "AccessRequest",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Kind = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    FirstName = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: false),
                    LastName = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: false),
                    MobileNumber = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    SignInEmail = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: false),
                    PasswordHash = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: false),
                    ContactEmail = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: true),
                    SchoolName = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: true),
                    GradeName = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: true),
                    ParentName = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: true),
                    ParentMobileNumber = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: true),
                    Note = table.Column<string>(type: "nvarchar(1024)", maxLength: 1024, nullable: true),
                    Status = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    DecidedById = table.Column<int>(type: "int", nullable: true),
                    DecidedOn = table.Column<DateTime>(type: "datetime2", nullable: true),
                    RejectionReason = table.Column<string>(type: "nvarchar(1024)", maxLength: 1024, nullable: true),
                    ApprovedTenantId = table.Column<int>(type: "int", nullable: true),
                    ApprovedUserId = table.Column<int>(type: "int", nullable: true),
                    RowVersion = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: true),
                    CreatedById = table.Column<int>(type: "int", nullable: false),
                    CreatedOn = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETUTCDATE()"),
                    LastModifiedById = table.Column<int>(type: "int", nullable: true),
                    LastModifiedOn = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AccessRequest", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AccessRequest_Tenant_ApprovedTenantId",
                        column: x => x.ApprovedTenantId,
                        principalTable: "Tenant",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_AccessRequest_User_ApprovedUserId",
                        column: x => x.ApprovedUserId,
                        principalTable: "User",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_AccessRequest_ApprovedTenantId",
                table: "AccessRequest",
                column: "ApprovedTenantId");

            migrationBuilder.CreateIndex(
                name: "IX_AccessRequest_ApprovedUserId",
                table: "AccessRequest",
                column: "ApprovedUserId");

            migrationBuilder.CreateIndex(
                name: "IX_AccessRequest_SignInEmail",
                table: "AccessRequest",
                column: "SignInEmail",
                unique: true,
                filter: "[Status] = 'Pending'");

            migrationBuilder.CreateIndex(
                name: "IX_AccessRequest_Status_CreatedOn",
                table: "AccessRequest",
                columns: new[] { "Status", "CreatedOn" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AccessRequest");
        }
    }
}
