import { parseSubjectsJson, SUBJECT_IMPORT_SAMPLE } from './subject-import';

/**
 * Pure-function tests for the subject import parser. No TestBed/DI — the
 * logic is static and deterministic (same approach as bulk-question-upload.spec.ts).
 */
describe('parseSubjectsJson', () => {
  const validSubject = { name: 'Mathematics', color: '#6366f1' };

  it('parses a bare array root', () => {
    const { subjects, errors } = parseSubjectsJson([validSubject]);
    expect(errors).toEqual([]);
    expect(subjects.length).toBe(1);
    expect(subjects[0].name).toBe(validSubject.name);
    expect(subjects[0].color).toBe(validSubject.color);
  });

  it('parses a { subjects: [...] } root', () => {
    const { subjects, errors } = parseSubjectsJson({ subjects: [validSubject] });
    expect(errors).toEqual([]);
    expect(subjects.length).toBe(1);
  });

  it('accepts a subject with no color', () => {
    const { subjects, errors } = parseSubjectsJson([{ name: 'Arabic' }]);
    expect(errors).toEqual([]);
    expect(subjects.length).toBe(1);
    expect(subjects[0].name).toBe('Arabic');
    expect(subjects[0].color).toBeUndefined();
  });

  it('preserves an explicit id', () => {
    const { subjects } = parseSubjectsJson([{ ...validSubject, id: 'subj-math' }]);
    expect(subjects[0].id).toBe('subj-math');
  });

  it('trims name, color and id', () => {
    const { subjects } = parseSubjectsJson([{ name: '  Padded  ', color: ' #fff ', id: ' s1 ' }]);
    expect(subjects[0]).toEqual({ name: 'Padded', color: '#fff', id: 's1' });
  });

  it('rejects a root that is neither an array nor { subjects: [...] }', () => {
    const { subjects, errors } = parseSubjectsJson({ foo: 'bar' });
    expect(subjects).toEqual([]);
    expect(errors.length).toBe(1);
  });

  it('rejects an empty subject list', () => {
    const { errors } = parseSubjectsJson([]);
    expect(errors.length).toBe(1);
  });

  it('flags a missing/blank name field', () => {
    const { subjects, errors } = parseSubjectsJson([{ name: '   ' }]);
    expect(subjects).toEqual([]);
    expect(errors[0]).toContain('"name"');
  });

  it('flags a non-string color', () => {
    const { errors } = parseSubjectsJson([{ name: 'Math', color: 5 }]);
    expect(errors[0]).toContain('"color"');
  });

  it('flags a non-string id', () => {
    const { errors } = parseSubjectsJson([{ name: 'Math', id: 5 }]);
    expect(errors[0]).toContain('"id"');
  });

  it('continues validating later rows after one fails', () => {
    const { subjects, errors } = parseSubjectsJson([{ name: '' }, validSubject]);
    expect(errors.length).toBe(1);
    expect(subjects.length).toBe(1);
    expect(subjects[0].name).toBe(validSubject.name);
  });

  it('parses its own downloadable sample with no errors', () => {
    const { subjects, errors } = parseSubjectsJson(SUBJECT_IMPORT_SAMPLE);
    expect(errors).toEqual([]);
    expect(subjects.length).toBe(SUBJECT_IMPORT_SAMPLE.subjects.length);
  });
});
