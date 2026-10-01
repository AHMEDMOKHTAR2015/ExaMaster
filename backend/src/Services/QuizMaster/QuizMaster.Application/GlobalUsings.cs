// Third-party libraries
global using MediatR;
global using Mapster;
global using FluentValidation;
global using Microsoft.EntityFrameworkCore;

// Internal libraries
global using Blocks.Core;
global using Blocks.Core.Security;
global using Blocks.Domain;
global using Blocks.Entities;
global using Blocks.Exceptions;
global using Blocks.MediatR;
global using Blocks.EntityFrameworkCore;
global using Blocks.FluentValidation;
global using QuizMasterPro.Abstractions;
global using QuizMasterPro.Abstractions.Enums;
global using QuizMasterPro.Security;

// Domain
global using QuizMaster.Domain.AccessRequests;
global using QuizMaster.Domain.Academic;
global using QuizMaster.Domain.Assignments;
global using QuizMaster.Domain.AttemptLocks;
global using QuizMaster.Domain.Grading;
global using QuizMaster.Domain.Participations;
global using QuizMaster.Domain.Notifications;
global using QuizMaster.Domain.Questions;
global using QuizMaster.Domain.Quizzes;
global using QuizMaster.Domain.Registration;
global using QuizMaster.Domain.Shared;
global using QuizMaster.Domain.Shared.Enums;
global using QuizMaster.Domain.TeacherQuizzes;
global using QuizMaster.Domain.Tenants;
global using QuizMaster.Domain.Translations;
global using QuizMaster.Domain.Users;

// Application
global using QuizMaster.Application.Dtos;
global using QuizMaster.Application.Features.Shared;

// Persistence
global using QuizMaster.Persistence;
global using QuizMaster.Persistence.Repositories;
