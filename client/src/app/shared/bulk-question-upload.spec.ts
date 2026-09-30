import { parseBulkQuestionsJson, BULK_UPLOAD_SAMPLE } from './bulk-question-upload';

/**
 * Pure-function tests for the bulk question upload parser. No TestBed/DI —
 * the logic is static and deterministic (same approach as quiz-management.spec.ts).
 */
describe('parseBulkQuestionsJson', () => {
  const validQuestion = {
    text: 'What is 2 + 2?',
    options: [{ id: 1, text: '3' }, { id: 2, text: '4' }],
    correctOptionId: 2
  };

  it('parses a bare array root', () => {
    const { questions, errors } = parseBulkQuestionsJson([validQuestion]);
    expect(errors).toEqual([]);
    expect(questions).toEqual([{ ...validQuestion, questionTypeId: 1 }]);
  });

  it('parses a { questions: [...] } root', () => {
    const { questions, errors } = parseBulkQuestionsJson({ questions: [validQuestion] });
    expect(errors).toEqual([]);
    expect(questions.length).toBe(1);
  });

  it('defaults questionTypeId to 1 (Choose) when omitted', () => {
    const { questions } = parseBulkQuestionsJson([validQuestion]);
    expect(questions[0].questionTypeId).toBe(1);
  });

  it('trims question and option text', () => {
    const { questions } = parseBulkQuestionsJson([{
      text: '  Padded?  ',
      options: [{ id: 1, text: ' a ' }, { id: 2, text: ' b ' }],
      correctOptionId: 1
    }]);
    expect(questions[0].text).toBe('Padded?');
    expect(questions[0].options[0].text).toBe('a');
  });

  it('rejects a root that is neither an array nor { questions: [...] }', () => {
    const { questions, errors } = parseBulkQuestionsJson({ foo: 'bar' });
    expect(questions).toEqual([]);
    expect(errors.length).toBe(1);
  });

  it('rejects an empty question list', () => {
    const { errors } = parseBulkQuestionsJson([]);
    expect(errors.length).toBe(1);
  });

  it('flags a missing/blank text field', () => {
    const { questions, errors } = parseBulkQuestionsJson([{ ...validQuestion, text: '   ' }]);
    expect(questions).toEqual([]);
    expect(errors[0]).toContain('"text"');
  });

  it('flags fewer than 2 options', () => {
    const { errors } = parseBulkQuestionsJson([{ ...validQuestion, options: [{ id: 1, text: 'only one' }] }]);
    expect(errors[0]).toContain('"options"');
  });

  it('flags duplicate option ids', () => {
    const { errors } = parseBulkQuestionsJson([{
      ...validQuestion,
      options: [{ id: 1, text: 'a' }, { id: 1, text: 'b' }]
    }]);
    expect(errors.some(e => e.includes('duplicate option id'))).toBe(true);
  });

  it('flags a correctOptionId that does not match any option', () => {
    const { errors } = parseBulkQuestionsJson([{ ...validQuestion, correctOptionId: 99 }]);
    expect(errors.some(e => e.includes('correctOptionId'))).toBe(true);
  });

  it('collects errors per-row while still parsing the valid rows', () => {
    const { questions, errors } = parseBulkQuestionsJson([
      validQuestion,
      { ...validQuestion, options: [{ id: 1, text: 'only one' }] },
      validQuestion
    ]);
    expect(questions.length).toBe(2);
    expect(errors.length).toBe(1);
    expect(errors[0]).toContain('Question 2');
  });

  it('accepts the bundled sample with zero errors', () => {
    const { questions, errors } = parseBulkQuestionsJson(BULK_UPLOAD_SAMPLE);
    expect(errors).toEqual([]);
    expect(questions.length).toBe(BULK_UPLOAD_SAMPLE.questions.length);
  });

  it('ignores the template\'s _readme key on re-upload', () => {
    // The download carries usage notes because JSON has no comments, and an
    // admin who edits the file will most often leave them in place. Round-trip
    // the exact bytes they receive.
    const asDownloaded = JSON.parse(JSON.stringify(BULK_UPLOAD_SAMPLE, null, 2));
    expect(asDownloaded._readme).toBeDefined();

    const { questions, errors } = parseBulkQuestionsJson(asDownloaded);

    expect(errors).toEqual([]);
    expect(questions.length).toBe(BULK_UPLOAD_SAMPLE.questions.length);
  });

  it('points the sample Choose row at the option that is actually correct', () => {
    // Structure alone cannot catch this: any existing option id parses. The
    // template is copied by every admin who builds a file, so a wrong worked
    // example propagates.
    const [firstRow] = BULK_UPLOAD_SAMPLE.questions;
    const correct = firstRow.options?.find(o => o.id === firstRow.correctOptionId);
    expect(correct?.text).toBe('56');
  });

  describe('Complete (questionTypeId: 2) rows', () => {
    it('parses a Complete row into masked name, segments and correctBlanks', () => {
      const { questions, errors } = parseBulkQuestionsJson([
        { text: 'The capital of France is Paris(Complete).', questionTypeId: 2 }
      ]);
      expect(errors).toEqual([]);
      expect(questions.length).toBe(1);
      const q = questions[0];
      expect(q.questionTypeId).toBe(2);
      expect(q.options).toEqual([]);
      expect(q.correctOptionId).toBeNull();
      expect(q.correctBlanks).toEqual(['Paris']);
      // Stored name is masked — never carries the answer.
      expect(q.text).toBe('The capital of France is _____.');
      expect(q.text).not.toContain('Paris');
      expect(q.segments).toBeDefined();
    });

    it('rejects a Complete row with no markers, with a useful message', () => {
      const { questions, errors } = parseBulkQuestionsJson([
        { text: 'This has no blanks at all.', questionTypeId: 2 }
      ]);
      expect(questions).toEqual([]);
      expect(errors[0]).toContain('(Complete)');
    });

    it('parses a mixed file of Choose and Complete rows', () => {
      const { questions, errors } = parseBulkQuestionsJson([
        validQuestion,
        { text: 'Water is H(Complete)2O.', questionTypeId: 2 }
      ]);
      expect(errors).toEqual([]);
      expect(questions.length).toBe(2);
      expect(questions[0].questionTypeId).toBe(1);
      expect(questions[1].questionTypeId).toBe(2);
      expect(questions[1].correctBlanks).toEqual(['H']);
    });
  });

  describe('Right or Wrong (questionTypeId: 3) rows', () => {
    it('parses a row into the canonical two-option pair and a correctOptionId', () => {
      const { questions, errors } = parseBulkQuestionsJson([
        { text: 'The Earth orbits the Sun.', questionTypeId: 3, isRight: true }
      ]);
      expect(errors).toEqual([]);
      const q = questions[0];
      expect(q.questionTypeId).toBe(3);
      expect(q.text).toBe('The Earth orbits the Sun.');
      expect(q.options).toEqual([{ id: 1, text: 'Right' }, { id: 2, text: 'Wrong' }]);
      expect(q.correctOptionId).toBe(1);
    });

    it('maps isRight: false to the Wrong option', () => {
      const { questions } = parseBulkQuestionsJson([
        { text: 'The Sun orbits the Earth.', questionTypeId: 3, isRight: false }
      ]);
      expect(questions[0].correctOptionId).toBe(2);
    });

    it('rejects a row with no verdict', () => {
      const { questions, errors } = parseBulkQuestionsJson([
        { text: 'Missing a verdict.', questionTypeId: 3 }
      ]);
      expect(questions).toEqual([]);
      expect(errors[0]).toContain('isRight');
    });
  });

  describe('Explain (questionTypeId: 4) rows', () => {
    const validExplain = {
      text: '<p>Explain photosynthesis.</p>',
      questionTypeId: 4,
      referenceAnswer: '<p>Plants convert light into chemical energy.</p>',
      weightPercent: 25
    };

    it('parses a row into a plain name, rich subject, reference answer and weight', () => {
      const { questions, errors } = parseBulkQuestionsJson([validExplain]);
      expect(errors).toEqual([]);
      const q = questions[0];
      expect(q.questionTypeId).toBe(4);
      expect(q.options).toEqual([]);
      expect(q.correctOptionId).toBeNull();
      // Stored name is the flattened prompt, never markup.
      expect(q.text).toBe('Explain photosynthesis.');
      expect(q.subjectHtml).toBe('<p>Explain photosynthesis.</p>');
      expect(q.referenceAnswer).toBe('<p>Plants convert light into chemical energy.</p>');
      expect(q.weightPercent).toBe(25);
    });

    it('defaults the weight when none is supplied', () => {
      const { weightPercent } = { ...validExplain, weightPercent: undefined };
      expect(weightPercent).toBeUndefined();
      const { questions } = parseBulkQuestionsJson([
        { text: 'Explain gravity.', questionTypeId: 4, referenceAnswer: 'Mass attracts mass.' }
      ]);
      expect(questions[0].weightPercent).toBe(10);
    });

    it('rejects a row with no reference answer', () => {
      const { questions, errors } = parseBulkQuestionsJson([
        { text: 'Explain gravity.', questionTypeId: 4 }
      ]);
      expect(questions).toEqual([]);
      expect(errors[0]).toContain('referenceAnswer');
    });

    it('rejects a weight outside 1–100', () => {
      const { questions, errors } = parseBulkQuestionsJson([
        { ...validExplain, weightPercent: 140 }
      ]);
      expect(questions).toEqual([]);
      expect(errors[0]).toContain('weightPercent');
    });
  });

  describe('unsupported question types', () => {
    it('rejects an unknown questionTypeId rather than storing it as Choose', () => {
      const { questions, errors } = parseBulkQuestionsJson([
        { ...validQuestion, questionTypeId: 99 }
      ]);
      expect(questions).toEqual([]);
      expect(errors[0]).toContain('99');
    });
  });

  describe('all four types together', () => {
    it('parses a file mixing every supported type', () => {
      const { questions, errors } = parseBulkQuestionsJson([
        validQuestion,
        { text: 'Water is H(Complete)2O.', questionTypeId: 2 },
        { text: 'The Earth orbits the Sun.', questionTypeId: 3, isRight: true },
        { text: 'Explain gravity.', questionTypeId: 4, referenceAnswer: 'Mass attracts mass.' }
      ]);
      expect(errors).toEqual([]);
      expect(questions.map(q => q.questionTypeId)).toEqual([1, 2, 3, 4]);
    });
  });
});
