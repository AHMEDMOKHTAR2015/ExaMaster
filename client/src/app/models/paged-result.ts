export interface PagedResult<T> {
  items: T[];
  nextCursor?: string;
}
