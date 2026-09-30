import { matchesBankFilter } from './question-bank-filters';
import { QuestionAdminItem } from '../interfaces';

function question(overrides: Partial<QuestionAdminItem> = {}): QuestionAdminItem {
  return {
    id: 1,
    name: 'Present perfect',
    questionTypeId: 1,
    options: [],
    stageId: 'stage-primary',
    gradeId: 'grade-4',
    subjectId: 'subject-english',
    ...overrides
  };
}

describe('matchesBankFilter', () => {
  it('keeps everything when nothing is selected', () => {
    expect(matchesBankFilter(question(), {})).toBe(true);
  });

  /** The reason the Grade select exists: narrow the bank to one year. */
  it('narrows to the chosen grade', () => {
    expect(matchesBankFilter(question({ gradeId: 'grade-4' }), { gradeId: 'grade-4' })).toBe(true);
    expect(matchesBankFilter(question({ gradeId: 'grade-5' }), { gradeId: 'grade-4' })).toBe(false);
  });

  /**
   * Strict on purpose. An unclassified question is not "suitable for every
   * year" — including it would put a question written for another grade into a
   * specific group's quiz without anyone choosing that.
   */
  it('excludes an unclassified question once a grade is chosen', () => {
    expect(matchesBankFilter(question({ gradeId: undefined }), { gradeId: 'grade-4' })).toBe(false);
  });

  it('still offers unclassified questions when no grade is chosen', () => {
    expect(matchesBankFilter(question({ gradeId: undefined }), { stageId: 'stage-primary' })).toBe(true);
  });

  /**
   * The opposite rule, and the asymmetry is deliberate: most banks are authored
   * without a semester, so excluding those would empty the picker for any
   * teacher who sets a term.
   */
  it('treats a question with no semester as belonging to any semester', () => {
    expect(matchesBankFilter(question({ semester: undefined }), { semester: 'first' })).toBe(true);
    expect(matchesBankFilter(question({ semester: 'second' }), { semester: 'first' })).toBe(false);
  });

  it('applies stage, grade, subject and search together', () => {
    const filter = {
      stageId: 'stage-primary',
      gradeId: 'grade-4',
      subjectId: 'subject-english',
      search: 'perfect'
    };

    expect(matchesBankFilter(question(), filter)).toBe(true);
    expect(matchesBankFilter(question({ subjectId: 'subject-math' }), filter)).toBe(false);
    expect(matchesBankFilter(question({ name: 'Past simple' }), filter)).toBe(false);
  });
});
