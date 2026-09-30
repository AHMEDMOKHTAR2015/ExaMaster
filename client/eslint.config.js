// @ts-check
const eslint = require("@eslint/js");
const { defineConfig } = require("eslint/config");
const tseslint = require("typescript-eslint");
const angular = require("angular-eslint");

/*
 * ESLint was retrofitted onto an existing codebase, so the baseline is not
 * "zero findings by construction" — it is "zero findings that gate, and every
 * remaining one visible".
 *
 * The rules relaxed below are relaxed for a stated reason, not to make the
 * output green. Anything downgraded to `warn` is a real finding kept in view;
 * anything switched off is switched off for a specific file set, never
 * globally.
 */
module.exports = defineConfig([
  {
    files: ["**/*.ts"],
    extends: [
      eslint.configs.recommended,
      tseslint.configs.recommended,
      tseslint.configs.stylistic,
      angular.configs.tsRecommended,
    ],
    processor: angular.processInlineTemplates,
    rules: {
      "@angular-eslint/directive-selector": [
        "error",
        {
          type: "attribute",
          prefix: "app",
          style: "camelCase",
        },
      ],
      "@angular-eslint/component-selector": [
        "error",
        {
          type: "element",
          prefix: "app",
          style: "kebab-case",
        },
      ],
      // A leading underscore is this codebase's existing marker for "required by
      // the signature, deliberately unused" — honour it instead of flagging it.
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
      // `interface MixinBase {}` in `interfaces/service-state.ts` is a marker
      // interface for the service mixins — an empty body is the point.
      "@typescript-eslint/no-empty-object-type": ["error", { allowInterfaces: "always" }],
    },
  },
  {
    // The quiz-taking components predate the `app-` selector convention and are
    // referenced by bare tags (`<question-options>`, `<quiz-result>`, …) across
    // the quiz templates. Renaming them is a mechanical but wide change, so the
    // rule is scoped off here rather than weakened for the whole project — new
    // components still have to use the prefix.
    files: [
      "src/app/question-complete/**/*.ts",
      "src/app/question-explain/**/*.ts",
      "src/app/question-options/**/*.ts",
      "src/app/quiz-result/**/*.ts",
      "src/app/shared/rich-text-editor/**/*.ts",
    ],
    rules: { "@angular-eslint/component-selector": "off" },
  },
  {
    // NO FIREBASE. The app moved off Firebase entirely: data, sign-in and
    // server logic all live in the QuizMasterPro.Backend API, reached through
    // `ApiClient`. A Firebase import coming back would quietly reintroduce a
    // second backend (and a second identity), so it is refused outright.
    files: ["src/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["@angular/fire", "@angular/fire/*", "firebase", "firebase/*", "@firebase/*"], message: "The app no longer uses Firebase. Talk to the API through ApiClient." },
          ],
        },
      ],
    },
  },
  {
    // Spec files stub collaborators with deliberately empty methods; that is
    // what a stub is.
    files: ["**/*.spec.ts"],
    rules: { "@typescript-eslint/no-empty-function": "off" },
  },
  {
    files: ["**/*.html"],
    extends: [
      angular.configs.templateRecommended,
      angular.configs.templateAccessibility,
    ],
    rules: {
      /*
       * ~156 real accessibility findings across the existing templates, in three
       * families:
       *
       *   label-has-associated-control (~109) — the app's form pattern is a
       *     `<label class="field__label">` sitting next to, not wrapping, its
       *     input, with no `for`/`id` pair. Screen readers do not announce the
       *     label.
       *   click-events-have-key-events (~26) and
       *   interactive-supports-focus (~21) — `(click)` on non-interactive
       *     elements, unreachable by keyboard.
       *
       * These are warnings rather than errors so `npm run lint` can gate new
       * work today. They are NOT accepted: fixing them is its own task, and the
       * warning count is the tracker. Do not add new ones — a fresh violation
       * should be fixed at the point it is written.
       */
      "@angular-eslint/template/label-has-associated-control": "warn",
      "@angular-eslint/template/click-events-have-key-events": "warn",
      "@angular-eslint/template/interactive-supports-focus": "warn",
    },
  },
]);
