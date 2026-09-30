export interface QuizConfig {
    ImagePath?: string;  // a quiz cover image: an asset under assets/quiz-images
    allowBack: boolean;
    allowReview: boolean;
    autoMove: boolean;  // if boolean; it will move to next question automatically when answered.
    duration: number;  // indicates the time in which quiz needs to be completed. 0 means unlimited.
    pageSize: number;
    requiredAll: boolean;  // indicates if you must answer all the questions before submitting.
    richText: boolean;
    shuffleQuestions: boolean;
    shuffleOptions: boolean;
    showClock: boolean;
    showPager: boolean;
    /**
     * "One Time Join": the student gets one, uninterrupted sitting.
     *
     * Optional rather than required so every existing config literal (and every
     * quiz already in Firestore) keeps compiling and reading as `false`. When
     * true the runner hides the app chrome, refuses to let the attempt be
     * abandoned, and records a lock the student cannot clear themselves — see
     * `services/quiz/quiz-lockdown.service.ts`.
     */
    oneTimeJoin?: boolean;
}
