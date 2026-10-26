import { Injectable, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import {
  ArabicExplanation, MaterialBlock, MaterialLesson, MaterialOverview, MaterialUnit, TeachingMaterial, TeachingMaterialSummary
} from '../models';
import { ApiClient } from './api/api-client.service';
import { ApiId, ApiMaterialLesson, ApiMaterialUnit, ApiTeachingMaterial, ApiTeachingMaterialSummary, idNumber, idString } from './api/api-models';
import { toSemester } from './api/question-mapping';
import { ServiceError } from './shared/service-error';

/**
 * Teaching materials, through the API (`/teaching-materials`): a teacher's
 * course content for one subject in one grade, uploaded as a teaching-summary
 * JSON document and read lesson by lesson. A teacher lists and opens what they
 * uploaded; an application admin, everyone's. The API decides, so no author id
 * is ever sent.
 */
@Injectable({ providedIn: 'root' })
export class TeachingMaterialService {
  private readonly api = inject(ApiClient);

  async list(filter: { subjectId?: string; gradeId?: string } = {}): Promise<TeachingMaterialSummary[]> {
    const { materials } = await this.api.get<{ materials: ApiTeachingMaterialSummary[] }>('/teaching-materials', {
      subjectId: idNumber(filter.subjectId) ?? undefined,
      gradeId: idNumber(filter.gradeId) ?? undefined
    });
    return materials.map(toSummary);
  }

  /** One material whole, for the reader; null when it is gone. */
  async getById(id: string): Promise<TeachingMaterial | null> {
    try {
      return toMaterial((await this.api.get<{ material: ApiTeachingMaterial }>(`/teaching-materials/${id}`)).material);
    } catch (error) {
      if (error instanceof ServiceError && error.code === '404') return null;
      throw error;
    }
  }

  /**
   * Uploads a document (the parsed JSON file, sent as it is) for a subject the
   * teacher teaches, in the grade they chose. Returns the new material's id.
   * A refusal lists every problem: see {@link uploadProblems}.
   */
  async upload(subjectId: string, gradeId: string, document: unknown): Promise<string> {
    const body = { subjectId: idNumber(subjectId), gradeId: idNumber(gradeId), document };
    return String((await this.api.post<ApiId>('/teaching-materials', body)).id);
  }

  async remove(id: string): Promise<void> {
    await this.api.delete(`/teaching-materials/${id}`);
  }
}

/**
 * What to show for a failed upload: each problem the API found in the document,
 * prefixed with where it is ("Unit 2, lesson 3, block 4 (table): row 1: …"),
 * else the API's own message.
 */
export function uploadProblems(error: unknown): string[] {
  if (error instanceof ServiceError && error.originalError instanceof HttpErrorResponse) {
    const body = (error.originalError.error ?? {}) as { Errors?: { PropertyName?: string; ErrorMessage?: string }[] };
    const problems = (body.Errors ?? [])
      .filter(problem => !!problem.ErrorMessage)
      .map(problem => problem.PropertyName ? `${problem.PropertyName}: ${problem.ErrorMessage}` : problem.ErrorMessage!);
    if (problems.length > 0) return problems;
  }
  return [error instanceof Error ? error.message : String(error)];
}

function toSummary(material: ApiTeachingMaterialSummary): TeachingMaterialSummary {
  return {
    id: String(material.id),
    sourceKey: material.sourceKey,
    title: material.title,
    subtitle: material.subtitle ?? undefined,
    subjectId: String(material.subjectId),
    gradeId: String(material.gradeId),
    semester: toSemester(material.semester),
    unitCount: material.unitCount,
    lessonCount: material.lessonCount,
    createdBy: String(material.createdById),
    uploadedByName: material.uploadedByName ?? undefined,
    createdAt: new Date(material.createdOn).getTime()
  };
}

function toMaterial(material: ApiTeachingMaterial): TeachingMaterial {
  return {
    id: String(material.id),
    sourceKey: material.sourceKey,
    title: material.title,
    subtitle: material.subtitle ?? undefined,
    forLabel: material.forLabel ?? undefined,
    subjectId: String(material.subjectId),
    gradeId: String(material.gradeId),
    semester: toSemester(material.semester),
    createdBy: String(material.createdById),
    createdAt: new Date(material.createdOn).getTime(),
    overview: (material.overview ?? {}) as MaterialOverview,
    units: material.units.map(toUnit)
  };
}

function toUnit(unit: ApiMaterialUnit): MaterialUnit {
  return {
    id: String(unit.id),
    number: unit.number,
    kind: unit.kind,
    title: unit.title,
    bookPageFrom: unit.bookPageFrom ?? undefined,
    bookPageTo: unit.bookPageTo ?? undefined,
    bigIdeaEnglish: unit.bigIdeaEnglish,
    bigIdeaArabic: unit.bigIdeaArabic,
    keyTakeaways: unit.keyTakeaways,
    lessons: unit.lessons.map(toLesson)
  };
}

/** One lesson as the reader shows it; a teaching room's board carries the same shape. */
export function toLesson(lesson: ApiMaterialLesson): MaterialLesson {
  return {
    id: idString(lesson.id)!,
    order: lesson.order,
    code: lesson.code,
    title: lesson.title,
    // the API validated every block's shape on upload
    content: lesson.content as MaterialBlock[],
    arabicExplanation: lesson.arabicExplanation as ArabicExplanation
  };
}
