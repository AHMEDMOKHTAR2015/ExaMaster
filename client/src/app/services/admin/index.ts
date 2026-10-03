/**
 * Public API for the admin services.
 *
 * Import admin services from `services/admin` rather than reaching into the
 * individual files, so internal reorganisation stays invisible to consumers.
 * Pure re-exports only — keep this file free of logic to avoid circular imports.
 */

// Core
export * from './core/admin-access.service';
export * from './core/dashboard-stats.service';

// Role strategies
export * from './strategies/application-admin.strategy';
export * from './strategies/user-admin.strategy';
export * from './strategies/teacher.strategy';
export * from './strategies/no-admin.strategy';

// Academic catalog entities
export * from './academic/stage.service';
export * from './academic/grade.service';
export * from './academic/class-group.service';
export * from './academic/subject.service';

// Users
export * from './users/app-user.service';
export * from './users/user-admin.service';

// Teachers
export * from './teachers/teacher.service';
export * from './teachers/teacher-account.service';
export * from './teachers/teacher-scope.service';
export * from './teachers/teacher-stats.service';
export * from './teachers/teacher-students.service';

// Quizzes
export * from './quizzes/quiz-admin.service';
export * from './quizzes/participation.service';
export * from './quizzes/homework-participation.service';
export * from './quizzes/quiz-counts.service';

// Registration
export * from './registration/registration-key-admin.service';
