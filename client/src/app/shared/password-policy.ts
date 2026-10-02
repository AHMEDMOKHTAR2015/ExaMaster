/**
 * The API's password rule (PasswordPolicy in the backend): at least 8 characters for every NEW password, and not one of
 * the commonly used ones — that second check is the server's alone, and its message is shown as it comes. Mirrored here
 * so a too-short password is caught before a round trip. Existing shorter passwords still sign in.
 */
export const MIN_PASSWORD_LENGTH = 8;
