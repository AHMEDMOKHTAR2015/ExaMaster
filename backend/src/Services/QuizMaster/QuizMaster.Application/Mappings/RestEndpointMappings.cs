namespace QuizMaster.Application.Mappings;

public class RestEndpointMappings : IRegister
{
    public void Register(TypeAdapterConfig config)
    {
        // Value objects and the small JSON records (options, segments, blanks) are immutable: pass them through as-is.
        config.Default.ShallowCopyForSameType(true);

        config.NewConfig<Subject, SubjectDto>()
            .Map(dest => dest.Tags, src => src.Tags.OrderBy(tag => tag.Name));

        config.NewConfig<Question, QuestionDto>()
            .Map(dest => dest.Text, src => AuthoringText(src))
            .Map(dest => dest.Key, src => new AnswerKeyDto(src.Id, src.CorrectOptionId, src.CorrectBlanks, src.ReferenceAnswer));

        config.NewConfig<TeacherQuizQuestion, TeacherQuizQuestionDto>()
            .Map(dest => dest.Text, src => AuthoringText(src))
            .Map(dest => dest.Key, src => new AnswerKeyDto(src.Number, src.CorrectOptionId, src.CorrectBlanks, src.ReferenceAnswer));

        config.NewConfig<TeacherQuiz, TeacherQuizDto>()
            .Map(dest => dest.Questions, src => src.Questions.OrderBy(question => question.Number));

        config.NewConfig<TeacherQuiz, TeacherQuizSummaryDto>()
            .Map(dest => dest.QuestionCount, src => src.Questions.Count);

        config.NewConfig<BankQuiz, BankQuizDto>()
            .Map(dest => dest.QuestionIds, src => src.QuestionIdsInOrder);

        config.NewConfig<Participation, ParticipationDto>()
            .Map(dest => dest.Validation, src => src.ValidationStatus == null
                ? null
                : new ValidationDto(src.ValidationStatus.Value, src.ValidationFeedback, src.ValidatedById ?? 0, src.ValidatedOn ?? src.EndedOn))
            .Map(dest => dest.Answers, src => src.Answers.OrderBy(answer => answer.Position))
            .Map(dest => dest.ResultsAvailable, src => true);         // the handler withholds answers when they are not

        config.NewConfig<ParticipationAnswer, ParticipationAnswerDto>()
            .Map(dest => dest.SuggestedAward, src => src.Blanks == null ? (int?)null : QuizGrader.SuggestedCompleteAward(src.ToGradedAnswer()))
            .Map(dest => dest.ManualGrade, src => src.GradedOn == null
                ? null
                : new ManualGradeDto(src.AwardedPercent ?? 0, src.GradeComment, src.GradedById ?? 0, src.GradedOn.Value));
    }

    // What goes back into the authoring form: the statement, or the passage rebuilt with its "(Complete)" markers.
    private static string? AuthoringText(IQuestionDefinition question) => question.Type switch
    {
        QuestionType.Complete => CompletePassage.Reconstruct(question.Segments, question.Key.CorrectBlanks ?? []),
        QuestionType.Explain => null,
        _ => question.Name
    };
}
