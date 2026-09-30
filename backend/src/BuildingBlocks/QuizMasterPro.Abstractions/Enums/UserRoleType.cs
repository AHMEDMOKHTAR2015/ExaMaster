using System.ComponentModel;

namespace QuizMasterPro.Abstractions.Enums;

// One closed role vocabulary for the whole system. Reserve a numeric range per domain/service so codes stay grouped
// and future services have room: 1–9 cross-domain, 11–19 QuizMaster, 21–29 next service, ...
//
// Every role except PLATFORM_ADMIN is scoped to ONE tenant (organization): an APPLICATION_ADMIN administers their own
// school, never the deployment. Roles are read from the database on every request, not from token claims,
// so removing a role takes effect on the very next request.
public enum UserRoleType : int
{
    // Cross-domain: 1–9
    [Description("Platform administrator (the vendor; belongs to no tenant)")]
    PLATFORM_ADMIN = 1,
    [Description("Application administrator (administers one tenant)")]
    APPLICATION_ADMIN = 2,

    // QuizMaster: 11–19
    [Description("Teacher")]
    TEACHER = 11,
    [Description("Student")]
    STUDENT = 12,
    [Description("Parent (manages their children's accounts)")]
    PARENT = 13,
}
