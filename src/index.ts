import { Recurrence } from './Recurrence.ts';

export { Recurrence };
export { TEMPORAL_ERROR_CODES, TemporalApiError } from './errors.ts';
export type {
  RecurrenceEntry,
  RecurrenceFrequency,
  RecurrenceInput,
  RecurrenceParseOptions,
  RecurrenceRuleInput,
  RecurrenceWeekdayToken,
  RecurrenceWeekdayValue,
  TemporalDateLike,
} from './types.ts';
export type { TemporalErrorCode } from './errors.ts';

export function parse(...args: Parameters<typeof Recurrence.parse>): ReturnType<typeof Recurrence.parse> {
  return Recurrence.parse(...args);
}

export function rule(...args: Parameters<typeof Recurrence.rule>): ReturnType<typeof Recurrence.rule> {
  return Recurrence.rule(...args);
}
