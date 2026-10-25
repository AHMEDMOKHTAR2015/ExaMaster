import { readMaterialFile } from './teaching-material-file';

describe('readMaterialFile', () => {
  const document = {
    schemaVersion: 1,
    id: 'sec1-programming-ai-term1',
    title: 'Programming and AI',
    subtitle: 'An introduction',
    forLabel: 'First year · Term 1',
    audience: { semester: 'First' },
    units: [
      { number: 1, lessons: [{ code: '1-1' }, { code: '1-2' }] },
      { number: 2, lessons: [{ code: '2-1' }] }
    ]
  };

  it('previews a teaching summary: title, units, lessons and term', () => {
    const reading = readMaterialFile(JSON.stringify(document));

    expect('error' in reading).toBeFalse();
    if ('error' in reading) return;
    expect(reading.preview).toEqual({
      sourceKey: 'sec1-programming-ai-term1',
      title: 'Programming and AI',
      subtitle: 'An introduction',
      forLabel: 'First year · Term 1',
      semester: 'first',
      unitCount: 2,
      lessonCount: 3
    });
    expect(reading.document['id']).toBe('sec1-programming-ai-term1');
  });

  it('leaves the term out when the document does not say', () => {
    const reading = readMaterialFile(JSON.stringify({ ...document, audience: { semester: null } }));
    expect('error' in reading ? undefined : reading.preview.semester).toBeUndefined();
  });

  it('refuses text that is not JSON', () => {
    expect(readMaterialFile('{ not json')).toEqual({ error: 'notJson' });
  });

  it('refuses JSON that is not a teaching summary', () => {
    expect(readMaterialFile('[]')).toEqual({ error: 'notMaterial' });
    expect(readMaterialFile(JSON.stringify({ questions: [] }))).toEqual({ error: 'notMaterial' });
    expect(readMaterialFile(JSON.stringify({ id: 'x', title: 'X' }))).toEqual({ error: 'notMaterial' });
  });
});
