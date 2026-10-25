import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { ApiClient } from './api/api-client.service';
import { toServiceError } from './api/api-client.service';
import { ApiTeachingMaterial, ApiTeachingMaterialSummary } from './api/api-models';
import { TeachingMaterialService, uploadProblems } from './teaching-material.service';
import { ServiceError } from './shared/service-error';

describe('TeachingMaterialService', () => {
  let api: jasmine.SpyObj<ApiClient>;
  let service: TeachingMaterialService;

  beforeEach(() => {
    api = jasmine.createSpyObj<ApiClient>('ApiClient', ['get', 'post', 'delete']);
    TestBed.configureTestingModule({ providers: [{ provide: ApiClient, useValue: api }] });
    service = TestBed.inject(TeachingMaterialService);
  });

  it('lists summaries with string ids and the app\'s semester spelling', async () => {
    const row: ApiTeachingMaterialSummary = {
      id: 7, sourceKey: 'sec1', title: 'Programming', subtitle: null, subjectId: 1, gradeId: 2, semester: 'First',
      unitCount: 13, lessonCount: 55, createdById: 4, uploadedByName: 'Tarek', createdOn: '2026-10-23T10:00:00Z'
    };
    api.get.and.resolveTo({ materials: [row] });

    const [material] = await service.list({ subjectId: '1' });

    expect(api.get).toHaveBeenCalledWith('/teaching-materials', { subjectId: 1, gradeId: undefined });
    expect(material).toEqual(jasmine.objectContaining({
      id: '7', subjectId: '1', gradeId: '2', semester: 'first', unitCount: 13, lessonCount: 55, createdBy: '4',
      uploadedByName: 'Tarek', subtitle: undefined
    }));
    expect(material.createdAt).toBe(Date.parse('2026-10-23T10:00:00Z'));
  });

  it('opens a material with its units and lessons in the order the API gives them', async () => {
    const material: ApiTeachingMaterial = {
      id: 7, sourceKey: 'sec1', title: 'Programming', subtitle: 'Intro', forLabel: null, subjectId: 1, gradeId: 2,
      semester: null, createdById: 4, createdOn: '2026-10-23T10:00:00Z', overview: { guide: 'How to use it' },
      units: [{
        id: 3, number: 1, kind: 'Chapter', title: 'Basics', bookPageFrom: 4, bookPageTo: 11,
        bigIdeaEnglish: 'Big idea', bigIdeaArabic: 'الفكرة', keyTakeaways: ['One'],
        lessons: [{
          id: 9, order: 1, code: '1-1', title: 'First',
          content: [{ type: 'paragraph', text: 'Hello' }], arabicExplanation: { title: 'الشرح', items: [] }
        }]
      }]
    };
    api.get.and.resolveTo({ material });

    const opened = await service.getById('7');

    expect(api.get).toHaveBeenCalledWith('/teaching-materials/7');
    expect(opened?.overview.guide).toBe('How to use it');
    expect(opened?.semester).toBeUndefined();
    expect(opened?.units[0]).toEqual(jasmine.objectContaining({ id: '3', bookPageFrom: 4, bookPageTo: 11 }));
    expect(opened?.units[0].lessons[0]).toEqual({
      id: '9', order: 1, code: '1-1', title: 'First',
      content: [{ type: 'paragraph', text: 'Hello' }], arabicExplanation: { title: 'الشرح', items: [] }
    });
  });

  it('answers null for a material that is gone', async () => {
    api.get.and.rejectWith(new ServiceError('404', 'Not found'));
    expect(await service.getById('7')).toBeNull();
  });

  it('uploads the document as it is, with numeric subject and grade ids', async () => {
    api.post.and.resolveTo({ id: 12 });
    const document = { id: 'sec1', title: 'Programming', units: [] };

    expect(await service.upload('1', '2', document)).toBe('12');
    expect(api.post).toHaveBeenCalledWith('/teaching-materials', { subjectId: 1, gradeId: 2, document });
  });
});

describe('uploadProblems', () => {
  it('lists every problem the API found, each with where it is', () => {
    const error = toServiceError(new HttpErrorResponse({
      status: 400,
      error: {
        Message: 'Validation failed',
        Errors: [
          { PropertyName: 'Unit 2, lesson 1, block 1 (table): row 1', ErrorMessage: 'The row has 1 cells but the table has 2 columns.' },
          { PropertyName: 'audience.semester', ErrorMessage: 'The semester must be "First", "Second", "Full" or null.' }
        ]
      }
    }));

    expect(uploadProblems(error)).toEqual([
      'Unit 2, lesson 1, block 1 (table): row 1: The row has 1 cells but the table has 2 columns.',
      'audience.semester: The semester must be "First", "Second", "Full" or null.'
    ]);
  });

  it('falls back to the API\'s own message (a duplicate, a subject not taught)', () => {
    const error = toServiceError(new HttpErrorResponse({ status: 409, error: { Message: 'You already uploaded "X" for Science, Grade 4.' } }));
    expect(uploadProblems(error)).toEqual(['You already uploaded "X" for Science, Grade 4.']);
  });
});
