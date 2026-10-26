import { TeachingRoomAdmission, TeachingRoomState } from '../models';

/** Whether this standing shows the board: the presenting teacher and the students they let in. */
export function seesBoard(admission: TeachingRoomAdmission | null): boolean {
  return admission === 'teacher' || admission === 'approved';
}

/**
 * The state a page should show when another arrives. A move's broadcast can
 * overtake the answer to the page's own join (or the teacher's own click), so
 * an incoming state older than the one shown — a lower revision of the same
 * room — is ignored rather than stepping the board back.
 */
export function newerState(current: TeachingRoomState | null, incoming: TeachingRoomState): TeachingRoomState {
  return current && current.roomId === incoming.roomId && incoming.revision < current.revision ? current : incoming;
}
