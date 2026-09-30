namespace QuizMaster.Application.Features.Attempts.Shared;

// Loads the quiz behind an attempt, questions and answer keys included, for sitting, locking and grading.
//insight - for an assignment, the ASSIGNMENT decides which quiz is graded, never ids the client sends alongside it:
// otherwise a submission could be recorded against one assignment while graded against another quiz
public class AttemptedQuizLoader(
    BankQuizRepository _bankQuizRepository,
    Repository<Question> _questionRepository,
    TeacherQuizRepository _teacherQuizRepository,
    Repository<HomeworkAssignment> _assignmentRepository)
{
    public async Task<(AttemptedQuiz Quiz, HomeworkAssignment? Homework)> LoadAsync(IAttemptTarget target, CancellationToken ct)
    {
        if (target.HomeworkId is { } homeworkId)
        {
            var homework = Guard.NotFound(await _assignmentRepository.GetByIdAsync(homeworkId, ct));
            var quiz = homework.Source == QuizSource.Bank
                ? await LoadBankQuizAsync(homework.BankQuizId!.Value, ct)
                : await LoadTeacherQuizAsync(homework.TeacherQuizId!.Value, ct);
            return (quiz, homework);
        }

        if (target.BankQuizId is { } bankQuizId)
            return (await LoadBankQuizAsync(bankQuizId, ct), null);

        return (await LoadTeacherQuizAsync(target.TeacherQuizId!.Value, ct), null);
    }

    public async Task<AttemptedQuiz> LoadBankQuizAsync(int bankQuizId, CancellationToken ct)
    {
        var quiz = Guard.NotFound(await _bankQuizRepository.GetByIdAsync(bankQuizId, ct));
        var questions = await _questionRepository.GetByIdsAsync(quiz.QuestionIdsInOrder, ct);
        return quiz.ForAttempt(questions);
    }

    public async Task<AttemptedQuiz> LoadTeacherQuizAsync(int teacherQuizId, CancellationToken ct)
        => Guard.NotFound(await _teacherQuizRepository.GetByIdAsync(teacherQuizId, ct)).ForAttempt();
}
