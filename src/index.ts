/**
 * Temporal-first recurrence API for rules, composed schedules, and RFC 5545
 * parsing.
 *
 * This entrypoint exposes the `Recurrence` class, convenience constructors,
 * public error types, and the input types used to build recurrence
 * expressions.
 *
 * @module
 */
import { Recurrence } from './Recurrence.ts';

export { Recurrence };
export { TEMPORAL_ERROR_CODES, TemporalApiError } from './errors.ts';
export type {
  RecurrenceEntry,
  RecurrenceElapsedInput,
  RecurrenceJsonElapsedInput,
  RecurrenceJsonOptions,
  RecurrenceFrequency,
  RecurrenceInput,
  RecurrenceJson,
  RecurrenceJsonEntry,
  RecurrenceJsonRuleInput,
  RecurrenceParseOptions,
  RecurrenceRuleInput,
  RecurrenceWeekdayToken,
  RecurrenceWeekdayValue,
  TemporalDateLike,
} from './types.ts';
export type { TemporalErrorCode } from './errors.ts';

/**
 * Convenience alias for {@link Recurrence.parse}.
 */
export function parse(...args: Parameters<typeof Recurrence.parse>): ReturnType<typeof Recurrence.parse> {
  return Recurrence.parse(...args);
}

/**
 * Convenience alias for {@link Recurrence.rule}.
 */
export function rule(...args: Parameters<typeof Recurrence.rule>): ReturnType<typeof Recurrence.rule> {
  return Recurrence.rule(...args);
}

/** Convenience alias for the anchored elapsed cadence constructor. */
export function elapsed(...args: Parameters<typeof Recurrence.elapsed>): ReturnType<typeof Recurrence.elapsed> {
  return Recurrence.elapsed(...args);
}
