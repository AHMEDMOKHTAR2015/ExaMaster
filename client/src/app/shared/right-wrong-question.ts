/**
 * Helpers for the "Right or Wrong" (true/false) question type.
 *
 * Kept out of any component/service so it can be unit-tested without a browser
 * or Firebase (mirrors `shared/complete-question.ts` and
 * `shared/bulk-question-upload.ts`). Nothing here does I/O.
 *
 * Storage model: a Right or Wrong question is persisted as an ordinary
 * two-option Choose question — the canonical `Right`/`Wrong` pair on
 * `/Questions` and a plain `correctOptionId` on `/Answers`. That is deliberate:
 * every downstream path (answered-detection, grading, the result screen, the
 * teacher review popup) already handles a Choose question, so the new type needs
 * no branch in any of them. `questionTypeId: 3` exists so the *authoring* UI can
 * offer a statement + Right/Wrong toggle instead of a free-form options editor,
 * and so the renderer knows to translate the two fixed labels.
 *
 * The stored option names stay canonical English; display is localized at render
 * time via {@link rightWrongLabelKey}. Storing one canonical form keeps grading,
 * persisted participation records and teacher review single-sourced regardless
 * of which language the question was authored in.
 */

/** Canonical option ids. Order is fixed: Right first, Wrong second. */
export const RIGHT_WRONG_OPTION = {
  RIGHT: 1,
  WRONG: 2,
} as const;

/** Canonical (untranslated) stored option names, indexed by option id. */
export const RIGHT_WRONG_OPTION_NAME: Record<number, string> = {
  [RIGHT_WRONG_OPTION.RIGHT]: 'Right',
  [RIGHT_WRONG_OPTION.WRONG]: 'Wrong',
};

/** The fixed option pair every Right or Wrong question stores. */
export function buildRightWrongOptions(): { id: number; name: string }[] {
  return [
    { id: RIGHT_WRONG_OPTION.RIGHT, name: RIGHT_WRONG_OPTION_NAME[RIGHT_WRONG_OPTION.RIGHT] },
    { id: RIGHT_WRONG_OPTION.WRONG, name: RIGHT_WRONG_OPTION_NAME[RIGHT_WRONG_OPTION.WRONG] },
  ];
}

/** Map the authoring toggle to the `correctOptionId` written to `/Answers`. */
export function rightWrongCorrectOptionId(isRight: boolean): number {
  return isRight ? RIGHT_WRONG_OPTION.RIGHT : RIGHT_WRONG_OPTION.WRONG;
}

/**
 * Inverse of {@link rightWrongCorrectOptionId}, for re-seeding the authoring
 * form when editing. Returns `null` when no correct option has been recorded, so
 * the editor can show "nothing selected yet" rather than defaulting to Wrong.
 */
export function readRightWrongIsRight(correctOptionId: number | null | undefined): boolean | null {
  if (correctOptionId === RIGHT_WRONG_OPTION.RIGHT) return true;
  if (correctOptionId === RIGHT_WRONG_OPTION.WRONG) return false;
  return null;
}

/** i18n key for an option's displayed label. Unknown ids fall back to Wrong. */
export function rightWrongLabelKey(optionId: number): string {
  return optionId === RIGHT_WRONG_OPTION.RIGHT ? 'questionTypes.right' : 'questionTypes.wrong';
}
