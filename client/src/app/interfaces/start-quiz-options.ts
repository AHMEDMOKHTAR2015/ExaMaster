export interface StartQuizOptions {
  /**
   * The assignment being answered, when the run came from one. The server then
   * decides which quiz is sat and graded, from the assignment itself.
   */
  homeworkId?: string | null;
}
