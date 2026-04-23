import type { RRuleStrOptions } from '@rrulenet/core';
import type { RuleFrequency } from '@rrulenet/core/rule';
import type { ByMonth, Skip } from '@rrulenet/core/options';

/**
 * Minimal `Temporal.Instant`-like shape accepted by the public API.
 */
export type TemporalInstantLike = {
  epochMilliseconds: number;
  toString(): string;
  toZonedDateTimeISO(timeZone: string): unknown;
};

/**
 * Minimal `Temporal.ZonedDateTime`-like shape accepted by the public API.
 */
export type TemporalZonedDateTimeLike = {
  epochMilliseconds: number;
  timeZoneId: string;
  toInstant(): { epochMilliseconds: number };
  toString(): string;
};

/**
 * Date-like values accepted by the Temporal-first recurrence API.
 */
export type TemporalDateLike = Date | TemporalInstantLike | TemporalZonedDateTimeLike;
/**
 * Supported recurrence frequencies.
 */
export type RecurrenceFrequency = RuleFrequency;
/**
 * Weekday token form used by the public API.
 */
export type RecurrenceWeekdayToken = 'MO' | 'TU' | 'WE' | 'TH' | 'FR' | 'SA' | 'SU';
/**
 * Public weekday selector form used in recurrence rule input.
 */
export type RecurrenceWeekdayValue =
  | RecurrenceWeekdayToken
  | number
  | `${number}${RecurrenceWeekdayToken}`
  | `+${number}${RecurrenceWeekdayToken}`
  | { weekday: RecurrenceWeekdayToken | number; ordinal?: number };

/**
 * Public rule input accepted by {@link Recurrence.rule} and rule entries.
 */
export interface RecurrenceRuleInput {
  freq: RecurrenceFrequency;
  start?: TemporalDateLike | null;
  tzid?: string | null;
  interval?: number;
  count?: number | null;
  until?: TemporalDateLike | null;
  wkst?: RecurrenceWeekdayToken | number | null;
  bySetPos?: number | number[] | null;
  byMonth?: ByMonth | ByMonth[] | null;
  byMonthDay?: number | number[] | null;
  byYearDay?: number | number[] | null;
  byWeekNo?: number | number[] | null;
  byDay?: RecurrenceWeekdayValue | RecurrenceWeekdayValue[] | null;
  byHour?: number | number[] | null;
  byMinute?: number | number[] | null;
  bySecond?: number | number[] | null;
  byEaster?: number | null;
  rscale?: string | null;
  skip?: Skip | null;
}

/**
 * Canonical constructor input shape for {@link Recurrence}.
 */
export interface RecurrenceInput {
  start?: TemporalDateLike | null;
  tzid?: string | null;
  include: RecurrenceEntry[];
  exclude?: RecurrenceEntry[];
}

/**
 * A single include or exclude entry in a recurrence expression.
 */
export type RecurrenceEntry =
  | { rule: RecurrenceRuleInput }
  | { dates: TemporalDateLike[] };

/**
 * Options accepted by {@link Recurrence.parse}.
 */
export interface RecurrenceParseOptions extends Partial<Omit<RRuleStrOptions, 'dtstart' | 'until' | 'tzid'>> {
  rruleString: string;
  start?: TemporalDateLike | null;
  tzid?: string | null;
  until?: TemporalDateLike | null;
}

/**
 * JSON-safe form of a single rule input.
 */
export interface RecurrenceJsonRuleInput {
  freq: RecurrenceFrequency;
  start?: string | null;
  tzid?: string | null;
  interval?: number;
  count?: number | null;
  until?: string | null;
  wkst?: RecurrenceWeekdayToken | number | null;
  bySetPos?: number | number[] | null;
  byMonth?: ByMonth | ByMonth[] | null;
  byMonthDay?: number | number[] | null;
  byYearDay?: number | number[] | null;
  byWeekNo?: number | number[] | null;
  byDay?: RecurrenceWeekdayValue | RecurrenceWeekdayValue[] | null;
  byHour?: number | number[] | null;
  byMinute?: number | number[] | null;
  bySecond?: number | number[] | null;
  byEaster?: number | null;
  rscale?: string | null;
  skip?: Skip | null;
}

/**
 * JSON-safe form of a recurrence entry.
 */
export type RecurrenceJsonEntry =
  | { rule: RecurrenceJsonRuleInput }
  | { dates: string[] };

/**
 * JSON-safe serialized form of a recurrence expression.
 */
export type RecurrenceJson =
  | {
    kind: 'input';
    start: string | null;
    tzid: string | null;
    include: RecurrenceJsonEntry[];
    exclude: RecurrenceJsonEntry[];
  }
  | {
    kind: 'union' | 'intersection';
    expressions: RecurrenceJson[];
  }
  | {
    kind: 'difference';
    include: RecurrenceJson;
    exclude: RecurrenceJson;
  };
