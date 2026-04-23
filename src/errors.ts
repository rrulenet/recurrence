export const TEMPORAL_ERROR_CODES = {
  INVALID_OPTIONS: 'TEMPORAL_INVALID_OPTIONS',
  INVALID_RRULE_STRING: 'TEMPORAL_INVALID_RRULE_STRING',
  INVALID_DATE: 'TEMPORAL_INVALID_DATE',
  INVALID_TZID: 'TEMPORAL_INVALID_TZID',
  UNSUPPORTED_INPUT: 'TEMPORAL_UNSUPPORTED_INPUT',
  TZID_CONTRADICTION: 'TEMPORAL_TZID_CONTRADICTION',
  CONFLICTING_ZONED_DATETIMES: 'TEMPORAL_CONFLICTING_ZONED_DATETIMES',
  INVALID_COLLECTION_ELEMENT: 'TEMPORAL_INVALID_COLLECTION_ELEMENT',
  INVALID_ENTRY: 'TEMPORAL_INVALID_ENTRY',
  UNSERIALIZABLE_EXPRESSION: 'TEMPORAL_UNSERIALIZABLE_EXPRESSION',
} as const;

export type TemporalErrorCode = (typeof TEMPORAL_ERROR_CODES)[keyof typeof TEMPORAL_ERROR_CODES];

export class TemporalApiError extends Error {
  readonly code: TemporalErrorCode;

  constructor(code: TemporalErrorCode, message: string) {
    super(message);
    this.name = 'TemporalApiError';
    this.code = code;
  }
}

export function recurrenceError(code: TemporalErrorCode, message: string): never {
  throw new TemporalApiError(code, message);
}
