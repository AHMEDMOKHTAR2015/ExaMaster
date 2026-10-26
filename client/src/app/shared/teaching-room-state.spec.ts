import { TeachingRoomState } from '../models';
import { newerState, seesBoard } from './teaching-room-state';

function state(revision: number, position: number, roomId = '7'): TeachingRoomState {
  return {
    roomId, position, revision, itemCount: 3, canGoPrevious: position > 1, canGoNext: position < 3,
    item: {
      unitNumber: 1, unitKind: 'Chapter', unitTitle: 'Basics', keyTakeaways: [], closesUnit: false,
      lesson: { id: String(position), order: position, code: `1-${position}`, title: 'Lesson', content: [], arabicExplanation: { title: '', items: [] } }
    }
  };
}

describe('teaching room state', () => {
  it('shows the board to the presenting teacher and admitted students only', () => {
    expect(seesBoard('teacher')).toBeTrue();
    expect(seesBoard('approved')).toBeTrue();
    for (const admission of ['none', 'mayRequest', 'pending', 'rejected', null] as const) {
      expect(seesBoard(admission)).withContext(String(admission)).toBeFalse();
    }
  });

  it('takes the first state, and a newer one', () => {
    expect(newerState(null, state(1, 1)).position).toBe(1);
    expect(newerState(state(1, 1), state(2, 2)).position).toBe(2);
  });

  it('ignores a state that arrives after a newer one', () => {
    // the answer to the join (revision 4) arrives after the broadcast of the next move (revision 5)
    expect(newerState(state(5, 3), state(4, 2)).position).toBe(3);
  });

  it('follows a move back, which is newer though its position is lower', () => {
    expect(newerState(state(5, 3), state(6, 2)).position).toBe(2);
  });

  it('never compares revisions across rooms', () => {
    expect(newerState(state(9, 3, '7'), state(1, 1, '8')).roomId).toBe('8');
  });
});
