import type { RRuleStrOptions } from '@rrulenet/core';
import type { RuleFrequency } from '@rrulenet/core/rule';
import type { ByMonth, Skip } from '@rrulenet/core/options';

export type TemporalInstantLike = {
  epochMilliseconds: number;
  toString(): string;
  toZonedDateTimeISO(timeZone: string): unknown;
};

export type TemporalZonedDateTimeLike = {
  epochMilliseconds: number;
  timeZoneId: string;
  toInstant(): { epochMilliseconds: number };
  toString(): string;
};

export type TemporalDateLike = Date | TemporalInstantLike | TemporalZonedDateTimeLike;
export type RecurrenceFrequency = RuleFrequency;
export type RecurrenceWeekdayToken = 'MO' | 'TU' | 'WE' | 'TH' | 'FR' | 'SA' | 'SU';
export type RecurrenceWeekdayValue =
  | RecurrenceWeekdayToken
  | number
  | `${number}${RecurrenceWeekdayToken}`
  | `+${number}${RecurrenceWeekdayToken}`
  | { weekday: RecurrenceWeekdayToken | number; ordinal?: number };

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

export interface RecurrenceInput {
  start?: TemporalDateLike | null;
  tzid?: string | null;
  include: RecurrenceEntry[];
  exclude?: RecurrenceEntry[];
}

export type RecurrenceEntry =
  | { rule: RecurrenceRuleInput }
  | { dates: TemporalDateLike[] };

export interface RecurrenceParseOptions extends Partial<Omit<RRuleStrOptions, 'dtstart' | 'until' | 'tzid'>> {
  rruleString: string;
  start?: TemporalDateLike | null;
  tzid?: string | null;
  until?: TemporalDateLike | null;
}

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

export type RecurrenceJsonEntry =
  | { rule: RecurrenceJsonRuleInput }
  | { dates: string[] };

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
