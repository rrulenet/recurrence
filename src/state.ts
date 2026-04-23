import { DateSource } from '@rrulenet/core';
import type { SetExpression } from '@rrulenet/core/engine';
import type { Options } from '@rrulenet/core/options';
import { Temporal } from 'temporal-polyfill';

import { TEMPORAL_ERROR_CODES, recurrenceError } from './errors.ts';
import {
  collectTemporalDateLikeTimezone,
  coerceTemporalDateLikeForTzid,
  createTimezoneResolution,
  finalizeTzid,
  isPlainObject,
  resolveTzid,
} from './temporal-coercion.ts';
import type { RecurrenceEntry, RecurrenceInput, TemporalDateLike } from './types.ts';
import { RuleRecurrenceSource, toCoreRuleOptions } from './rules.ts';

export type RuleEntryState = {
  kind: 'rule';
  source: RuleRecurrenceSource;
  options: Options;
};

export type DatesEntryState = {
  kind: 'dates';
  source: DateSource;
  values: Temporal.ZonedDateTime[];
};

export type EntryState = RuleEntryState | DatesEntryState;

export type RecurrenceState = {
  start: Temporal.ZonedDateTime | null;
  tzid: string | null;
  include: EntryState[];
  exclude: EntryState[];
};

export function validateEntries(entries: unknown, label: 'include' | 'exclude'): asserts entries is RecurrenceEntry[] {
  if (!Array.isArray(entries)) {
    recurrenceError(TEMPORAL_ERROR_CODES.INVALID_OPTIONS, `new Recurrence() expects ${label} to be an array`);
  }
}

export function validateDateArray(values: unknown, label: string): asserts values is TemporalDateLike[] {
  if (!Array.isArray(values)) {
    recurrenceError(TEMPORAL_ERROR_CODES.INVALID_OPTIONS, `${label} expects an array of date-like values`);
  }
}

export function normalizeEntry(
  entry: RecurrenceEntry,
  inheritedStart: TemporalDateLike | null | undefined,
  inheritedTzid: string | null | undefined,
): EntryState {
  if (!isPlainObject(entry)) {
    recurrenceError(TEMPORAL_ERROR_CODES.INVALID_COLLECTION_ELEMENT, 'Invalid recurrence entry');
  }

  const keys = Object.keys(entry).filter((key) => (entry as Record<string, unknown>)[key] !== undefined);
  if (keys.length !== 1) {
    recurrenceError(TEMPORAL_ERROR_CODES.INVALID_ENTRY, 'Each recurrence entry must define exactly one of rule or dates');
  }

  if ('rule' in entry) {
    if (!isPlainObject(entry.rule)) {
      recurrenceError(TEMPORAL_ERROR_CODES.INVALID_ENTRY, 'rule entries expect a plain rule object');
    }
    const normalized = toCoreRuleOptions(entry.rule, inheritedStart, inheritedTzid);
    return {
      kind: 'rule',
      source: new RuleRecurrenceSource(normalized.spec, normalized.normalized, normalized.serialized),
      options: normalized.normalized,
    };
  }

  validateDateArray(entry.dates, 'date entry');
  const tzid = inheritedTzid ?? 'UTC';
  const values = entry.dates.map((value) => {
    const coerced = coerceTemporalDateLikeForTzid(value, tzid);
    if (!coerced) recurrenceError(TEMPORAL_ERROR_CODES.INVALID_COLLECTION_ELEMENT, 'Invalid recurrence entry');
    return coerced.zonedDateTime;
  });
  return {
    kind: 'dates',
    source: new DateSource(values),
    values,
  };
}

export function buildState(input: RecurrenceInput): RecurrenceState {
  validateEntries(input.include, 'include');
  if (input.exclude !== undefined) validateEntries(input.exclude, 'exclude');

  const resolution = createTimezoneResolution(input.tzid);
  collectTemporalDateLikeTimezone(input.start, resolution);
  for (const entry of input.include) {
    if ('rule' in entry) {
      collectTemporalDateLikeTimezone(entry.rule.start ?? input.start, resolution);
      collectTemporalDateLikeTimezone(entry.rule.until, resolution);
      if (entry.rule.tzid) resolveTzid(entry.rule.tzid, resolution);
    } else {
      for (const value of entry.dates) collectTemporalDateLikeTimezone(value, resolution);
    }
  }
  for (const entry of input.exclude ?? []) {
    if ('rule' in entry) {
      collectTemporalDateLikeTimezone(entry.rule.start ?? input.start, resolution);
      collectTemporalDateLikeTimezone(entry.rule.until, resolution);
      if (entry.rule.tzid) resolveTzid(entry.rule.tzid, resolution);
    } else {
      for (const value of entry.dates) collectTemporalDateLikeTimezone(value, resolution);
    }
  }

  const tzid = finalizeTzid(resolution) ?? null;
  const start = coerceTemporalDateLikeForTzid(input.start, tzid)?.zonedDateTime ?? null;

  return {
    start,
    tzid,
    include: input.include.map((entry) => normalizeEntry(entry, input.start, tzid)),
    exclude: (input.exclude ?? []).map((entry) => normalizeEntry(entry, input.start, tzid)),
  };
}

export function expressionFromState(state: RecurrenceState): SetExpression {
  const include: SetExpression[] = state.include.map((entry) => ({ kind: 'source', source: entry.source }));
  const exclude: SetExpression[] = state.exclude.map((entry) => ({ kind: 'source', source: entry.source }));
  const includeExpression: SetExpression = { kind: 'union', expressions: include };
  return exclude.length
    ? { kind: 'difference', include: includeExpression, exclude: { kind: 'union', expressions: exclude } }
    : includeExpression;
}
