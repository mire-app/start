import type { ErrorCode } from './protocol';

/** A business rule enforced by a repository (e.g. `transfer_invalid`). */
export class DataError extends Error {
  constructor(
    readonly code: Extract<ErrorCode, 'transfer_invalid' | 'not_found'>,
    message: string = code,
  ) {
    super(message);
    this.name = 'DataError';
  }
}

// RAISE(ABORT, '<code>') messages from the schema's triggers.
const TRIGGER_CODES = ['category_depth', 'valuation_account_type'] as const;

/** The protocol code for an error thrown while running a call. */
export function errorCode(err: unknown): ErrorCode {
  if (err instanceof DataError) return err.code;
  const message = err instanceof Error ? err.message : String(err);
  const trigger = TRIGGER_CODES.find((code) => message.includes(code));
  if (trigger) return trigger;
  if (/\b(CHECK|FOREIGN KEY|UNIQUE|NOT NULL) constraint failed\b/.test(message))
    return 'constraint';
  return 'error';
}
