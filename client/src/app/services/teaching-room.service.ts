import { Injectable, inject } from '@angular/core';
import {
  TeachingRoom, TeachingRoomAdmission, TeachingRoomMember, TeachingRoomMemberStatus, TeachingRoomState, TeachingRoomSummary
} from '../models';
import { ApiClient } from './api/api-client.service';
import {
  ApiId, ApiTeachingRoom, ApiTeachingRoomAdmission, ApiTeachingRoomMember, ApiTeachingRoomState,
  ApiTeachingRoomSummary, idNumber
} from './api/api-models';
import { toLesson } from './teaching-material.service';
import { ServiceError } from './shared/service-error';

/**
 * Teaching rooms, through the API (`/teaching-rooms`): a teacher presents one of
 * their materials live, students of the classes it is for ask to join, and the
 * teacher lets them in. Every change is made here; the board itself arrives over
 * the room's live connection (`TeachingRoomConnection`). The API decides who may
 * do and see what, so no person or group id is ever sent beyond the route.
 */
@Injectable({ providedIn: 'root' })
export class TeachingRoomService {
  private readonly api = inject(ApiClient);

  /** A teacher's own rooms; a student's, the rooms for their class and those they asked to join. */
  async list(): Promise<TeachingRoomSummary[]> {
    const { rooms } = await this.api.get<{ rooms: ApiTeachingRoomSummary[] }>('/teaching-rooms');
    return rooms.map(toSummary);
  }

  /** One room as its page opens it; null when it is gone or not for the signed-in person. */
  async get(id: string): Promise<TeachingRoom | null> {
    try {
      const { room } = await this.api.get<{ room: ApiTeachingRoom }>(`/teaching-rooms/${id}`);
      return { ...toSummary(room), members: room.members?.map(toMember) ?? null };
    } catch (error) {
      if (error instanceof ServiceError && (error.code === '404' || error.code === '403')) return null;
      throw error;
    }
  }

  /** Opens a room on one of the teacher's materials; returns its id. */
  async open(materialId: string): Promise<string> {
    return String((await this.api.post<ApiId>('/teaching-rooms', { teachingMaterialId: idNumber(materialId) })).id);
  }

  /** Asks to join (a student); asking again changes nothing. Returns where they now stand. */
  async requestToJoin(id: string): Promise<TeachingRoomAdmission> {
    return toAdmission((await this.api.post<{ admission: ApiTeachingRoomAdmission }>(`/teaching-rooms/${id}/join-requests`)).admission);
  }

  async approve(id: string, studentId: string): Promise<void> {
    await this.api.post(`/teaching-rooms/${id}/members/${studentId}:approve`);
  }

  /** Turns a waiting student away, or removes an admitted one. */
  async reject(id: string, studentId: string): Promise<void> {
    await this.api.post(`/teaching-rooms/${id}/members/${studentId}:reject`);
  }

  /** Moves the board one item on; the API refuses it on the last item. */
  async next(id: string): Promise<TeachingRoomState> {
    return toState((await this.api.post<{ state: ApiTeachingRoomState }>(`/teaching-rooms/${id}:next`)).state);
  }

  /** Moves the board one item back; the API refuses it on the first item. */
  async previous(id: string): Promise<TeachingRoomState> {
    return toState((await this.api.post<{ state: ApiTeachingRoomState }>(`/teaching-rooms/${id}:previous`)).state);
  }

  async end(id: string): Promise<void> {
    await this.api.delete(`/teaching-rooms/${id}`);
  }
}

export function toAdmission(admission: ApiTeachingRoomAdmission): TeachingRoomAdmission {
  return (admission.charAt(0).toLowerCase() + admission.slice(1)) as TeachingRoomAdmission;
}

export function toState(state: ApiTeachingRoomState): TeachingRoomState {
  return {
    roomId: String(state.roomId),
    position: state.position,
    itemCount: state.itemCount,
    canGoPrevious: state.canGoPrevious,
    canGoNext: state.canGoNext,
    revision: state.revision,
    item: {
      unitNumber: state.item.unitNumber,
      unitKind: state.item.unitKind,
      unitTitle: state.item.unitTitle,
      keyTakeaways: state.item.keyTakeaways,
      closesUnit: state.item.closesUnit,
      lesson: toLesson(state.item.lesson)
    }
  };
}

function toSummary(room: ApiTeachingRoomSummary): TeachingRoomSummary {
  return {
    id: String(room.id),
    subjectId: String(room.subjectId),
    teachingMaterialId: String(room.teachingMaterialId),
    materialTitle: room.materialTitle,
    teacherName: room.teacherName ?? undefined,
    itemCount: room.itemCount,
    createdAt: new Date(room.createdOn).getTime(),
    admission: toAdmission(room.admission)
  };
}

function toMember(member: ApiTeachingRoomMember): TeachingRoomMember {
  return {
    studentId: String(member.studentId),
    studentName: member.studentName,
    className: member.className ?? undefined,
    status: member.status.toLowerCase() as TeachingRoomMemberStatus,
    requestedAt: new Date(member.requestedOn).getTime(),
    decidedAt: member.decidedOn ? new Date(member.decidedOn).getTime() : undefined
  };
}
