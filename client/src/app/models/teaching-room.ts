import { MaterialLesson } from './teaching-material';

/**
 * Where the signed-in person stands in a room, as the API decides it. Only
 * `teacher` (the one presenting it) and `approved` see the board.
 */
export type TeachingRoomAdmission = 'none' | 'mayRequest' | 'pending' | 'rejected' | 'approved' | 'teacher';

export type TeachingRoomMemberStatus = 'pending' | 'approved' | 'rejected';

/** A room as a list shows it: what is presented, by whom, and where the signed-in person stands. No content. */
export interface TeachingRoomSummary {
  id: string;
  subjectId: string;
  teachingMaterialId: string;
  materialTitle: string;
  teacherName?: string;
  itemCount: number;
  createdAt: number;
  admission: TeachingRoomAdmission;
}

/** A room as its page opens it. `members` is the presenting teacher's alone (null for a student). */
export interface TeachingRoom extends TeachingRoomSummary {
  members: TeachingRoomMember[] | null;
}

export interface TeachingRoomMember {
  /** The student's API user id. */
  studentId: string;
  studentName: string;
  className?: string;
  status: TeachingRoomMemberStatus;
  requestedAt: number;
  decidedAt?: number;
}

/**
 * The board: the item the teacher is on, one lesson of the material in reading
 * order. `revision` grows with every move, so a state that arrives late never
 * replaces a newer one (see `newerState`).
 */
export interface TeachingRoomState {
  roomId: string;
  /** 1-based. */
  position: number;
  itemCount: number;
  canGoPrevious: boolean;
  canGoNext: boolean;
  revision: number;
  item: TeachingRoomItem;
}

export interface TeachingRoomItem {
  unitNumber: number;
  unitKind: string;
  unitTitle: string;
  keyTakeaways: string[];
  /** The unit's last lesson closes with its key takeaways, as the reader shows it. */
  closesUnit: boolean;
  lesson: MaterialLesson;
}
