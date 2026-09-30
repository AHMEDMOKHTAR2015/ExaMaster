namespace QuizMaster.Domain.Grading;

// Grading a submitted quiz (port of the app's shared/grade-quiz.ts and shared/quiz-runner.ts).
//insight - pure functions only, and the ONLY grading implementation: a second copy that drifted would silently change marks
public static class QuizGrader
{
    public static QuizGrade Grade(IReadOnlyList<IQuestionDefinition> questions, IReadOnlyCollection<QuestionResponse> responses)
    {
        var hydrated = Hydrate(questions, responses);
        var weighting = QuizScoring.ComputeWeighting(questions.Select(ToWeightable).ToList());
        var answers = hydrated.Select(question => BuildAnswerDetail(question, weighting)).ToList();

        // Auto-graded questions only: an answer awaiting review has no verdict yet, and counting it as wrong
        // would misreport a pending answer as a failure.
        var autoGraded = answers.Where(answer => !answer.RequiresReview).ToList();
        var score = autoGraded.Count(answer => answer.IsCorrect);

        return new QuizGrade(
            answers,
            score,
            QuizScoring.RoundPercent(QuizScoring.SumEarnedPercent(answers.Select(answer => answer.EarnedPercent))),
            CorrectCount: score,
            WrongCount: autoGraded.Count - score,
            PendingReviewCount: answers.Count(answer => answer.RequiresReview));
    }

    // True when every question has a usable answer (vacuously true for an empty quiz).
    public static bool IsFullyAnswered(IReadOnlyList<IQuestionDefinition> questions, IReadOnlyCollection<QuestionResponse> responses)
        => Hydrate(questions, responses).All(IsAnswered);

    // What the exact-match grader would award a Complete answer, pro rata across its blanks, as the teacher's starting mark.
    public static int SuggestedCompleteAward(GradedAnswer answer)
    {
        var blanks = answer.Blanks ?? [];
        if (blanks.Count == 0)
            return 0;

        var matched = blanks.Count(blank => blank.IsCorrect);
        return QuizScoring.RoundPercent(answer.WeightPercent * matched / blanks.Count);
    }

    // Strips everything that would reveal the correct answer, keeping the verdict and the student's own response.
    // Applied to what a student RECEIVES before an assignment is over; never to what is persisted.
    public static GradedAnswer Redact(GradedAnswer answer) => answer with
    {
        CorrectOptionId = null,
        CorrectOptionText = null,
        ReferenceAnswer = null,
        Blanks = answer.Blanks?.Select(blank => blank with { CorrectAnswer = string.Empty }).ToList()
    };

    public static WeightableQuestion ToWeightable(IQuestionDefinition question)
        => new(question.QuestionId, question.Type, question.WeightPercent);

    // ---- the runtime shape the app's grader works on: the stored question, its key and the response, assembled ----

    private sealed record HydratedOption(int Id, string Name, bool IsAnswer, bool UserSelected);

    private sealed record HydratedBlank(int Index, string Answer, string UserAnswer);

    private sealed record HydratedQuestion(
        int Id,
        QuestionType Type,
        string Name,
        string? SubjectHtml,
        IReadOnlyList<HydratedOption> Options,
        IReadOnlyList<HydratedBlank> Blanks,
        string ResponseText,
        string ReferenceAnswer);

    private static List<HydratedQuestion> Hydrate(IReadOnlyList<IQuestionDefinition> questions, IReadOnlyCollection<QuestionResponse> responses)
    {
        // The stored questions are the authority on what belongs to the quiz: a response for any other id is never looked up.
        var responseByQuestion = new Dictionary<int, QuestionResponse>();
        foreach (var response in responses)
            responseByQuestion[response.QuestionId] = response;

        return questions
            .Select(question => Hydrate(question, responseByQuestion.GetValueOrDefault(question.QuestionId)))
            .ToList();
    }

    // A missing response grades as unanswered rather than throwing: skipping is legitimate when requiredAll is off.
    private static HydratedQuestion Hydrate(IQuestionDefinition question, QuestionResponse? response)
    {
        var key = question.Key;

        var options = question.Options
            .Select(option => new HydratedOption(
                option.Id,
                option.Name,
                IsAnswer: option.Id == key.CorrectOptionId,
                UserSelected: response?.SelectedOptionId is { } selected && option.Id == selected))
            .ToList();

        // Blanks are derived from the (masked) segments; the key is applied by blank INDEX, not by array position,
        // which is the safe reading when a passage's blank indices are not contiguous.
        var userAnswerByIndex = new Dictionary<int, string?>();
        foreach (var blank in response?.Blanks ?? [])
            userAnswerByIndex[blank.Index] = blank.UserAnswer;

        var correctBlanks = key.CorrectBlanks ?? [];
        var blanks = question.Type == QuestionType.Complete
            ? question.Segments
                .Where(segment => segment.IsBlank)
                .Select(segment => segment.Index!.Value)
                .Select(index => new HydratedBlank(
                    index,
                    Answer: index >= 0 && index < correctBlanks.Count ? correctBlanks[index] ?? string.Empty : string.Empty,
                    UserAnswer: userAnswerByIndex.GetValueOrDefault(index) ?? string.Empty))
                .ToList()
            : [];

        return new HydratedQuestion(
            question.QuestionId,
            question.Type,
            question.Name,
            question.SubjectHtml,
            options,
            blanks,
            ResponseText: response?.ResponseText ?? string.Empty,
            ReferenceAnswer: question.Type == QuestionType.Explain ? key.ReferenceAnswer ?? string.Empty : string.Empty);
    }

    private static GradedAnswer BuildAnswerDetail(HydratedQuestion question, QuizWeighting weighting)
    {
        var weightPercent = weighting.WeightOf(question.Id);

        if (question.Type == QuestionType.Explain)
        {
            var questionName = HtmlText.PlainText(question.SubjectHtml);
            return new GradedAnswer(
                question.Id,
                QuestionName: questionName.Length > 0 ? questionName : question.Name,
                SelectedOptionId: null, SelectedOptionText: null, CorrectOptionId: null, CorrectOptionText: null,
                IsCorrect: false,
                Blanks: null,
                ResponseText: question.ResponseText.Length > 0 ? question.ResponseText : null,
                ReferenceAnswer: question.ReferenceAnswer,
                weightPercent,
                EarnedPercent: null,
                RequiresReview: true);
        }

        if (question.Type == QuestionType.Complete)
        {
            // The per-blank exact match is still computed and persisted: it is the teacher's starting SUGGESTION, not the verdict.
            var blanks = question.Blanks
                .Select(blank => new GradedBlank(
                    blank.Index,
                    UserAnswer: CompletePassage.Trim(blank.UserAnswer) is { Length: > 0 } typed ? typed : null,
                    CorrectAnswer: blank.Answer,
                    IsCorrect: CompletePassage.Normalize(blank.UserAnswer) == CompletePassage.Normalize(blank.Answer)))
                .ToList();

            return new GradedAnswer(
                question.Id, question.Name,
                SelectedOptionId: null, SelectedOptionText: null, CorrectOptionId: null, CorrectOptionText: null,
                IsCorrect: false,
                blanks,
                ResponseText: null, ReferenceAnswer: null,
                weightPercent,
                EarnedPercent: null,
                RequiresReview: true);
        }

        // Choose and Right or Wrong share this branch: Right or Wrong is stored as a two-option Choose question.
        // Ids are compared, so an unanswered question with no key is wrong rather than vacuously right.
        var selected = question.Options.FirstOrDefault(option => option.UserSelected);
        var correct = question.Options.FirstOrDefault(option => option.IsAnswer);
        var isCorrect = selected is not null && correct is not null && selected.Id == correct.Id;

        return new GradedAnswer(
            question.Id, question.Name,
            selected?.Id, selected?.Name,
            correct?.Id, correct?.Name,
            isCorrect,
            Blanks: null,
            ResponseText: null, ReferenceAnswer: null,
            weightPercent,
            EarnedPercent: isCorrect ? weightPercent : 0,
            RequiresReview: false);
    }

    private static bool IsAnswered(HydratedQuestion question) => question.Type switch
    {
        QuestionType.Complete => question.Blanks.Count > 0 && question.Blanks.All(blank => CompletePassage.Trim(blank.UserAnswer).Length > 0),
        QuestionType.Explain => HtmlText.HasContent(question.ResponseText),
        _ => question.Options.Any(option => option.UserSelected)
    };
}
