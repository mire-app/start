import { v7 as uuidv7 } from 'uuid';

/** Row ids are UUIDv7 (ADR-0004): time-ordered and unique across devices. */
export const newId = (): string => uuidv7();

/** ISO-8601 UTC timestamp for created_at, updated_at and deleted_at. */
export const now = (): string => new Date().toISOString();
