import {
  buildRuleSpecFromResolvedTemporalOptions,
  normalizeOptions,
  optionsToString,
  type RuleSpec,
  type SourceQuery,
} from '@rrulenet/core/rule';
import { Temporal } from 'temporal-polyfill';
import { RuleSource } from '@rrulenet/core/engine';
import {
  isFullyConvertibleToText as isRuleFullyConvertibleToText,
  ruleToText,
  textMergeDescriptorForOptions,
  type TextMergeDescriptor,
  type ToTextOptions,
} from '@rrulenet/core/text';
import type { ByWeekday, Options } from '@rrulenet/core/options';
import { Weekday } from '@rrulenet/core/options';

import { TEMPORAL_ERROR_CODES, recurrenceError } from './errors.ts';
import {
  collectTemporalDateLikeTimezone,
  coerceTemporalDateLikeForTzid,
  createTimezoneResolution,
  finalizeTzid,
} from './temporal-coercion.ts';
import type { RecurrenceFrequency, RecurrenceRuleInput, RecurrenceWeekdayToken, RecurrenceWeekdayValue, TemporalDateLike } from './types.ts';

export class RuleRecurrenceSource implements SourceQuery {
  constructor(
    readonly spec: RuleSpec,
    readonly options: Options,
    private readonly serializedOptions: Partial<Options>,
  ) {}

  private get source() {
    return new RuleSource(this.spec);
  }

  all(): Temporal.ZonedDateTime[] {
    return this.source.all();
  }

  between(after: Temporal.Instant, before: Temporal.Instant, inc: boolean): Temporal.ZonedDateTime[] {
    return this.source.between(after, before, inc);
  }

  after(after: Temporal.Instant, inc: boolean): Temporal.ZonedDateTime | null {
    return this.source.after(after, inc);
  }

  before(before: Temporal.Instant, inc: boolean): Temporal.ZonedDateTime | null {
    return this.source.before(before, inc);
  }

  toTextDescription(textOptions?: ToTextOptions): string {
    return ruleToText(this.options, textOptions);
  }

  isFullyConvertibleToText(textOptions?: ToTextOptions): boolean {
    return isRuleFullyConvertibleToText(this.options, textOptions);
  }

  textMergeDescriptor(textOptions?: ToTextOptions): TextMergeDescriptor | null {
    return textMergeDescriptorForOptions(this.options, textOptions);
  }

  toSerializedString(): string {
    return optionsToString(this.serializedOptions);
  }
}

export function weekdayTokenToIndex(token: RecurrenceWeekdayToken): number {
  return ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'].indexOf(token);
}

function toWeekday(value: RecurrenceWeekdayValue): ByWeekday {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const match = /^([+-]?\d+)?(MO|TU|WE|TH|FR|SA|SU)$/.exec(value);
    if (!match) recurrenceError(TEMPORAL_ERROR_CODES.INVALID_OPTIONS, `Invalid byDay value: ${value}`);
    const weekday = Weekday.fromStr(match[2] as RecurrenceWeekdayToken);
    return match[1] ? weekday.nth(Number(match[1])) : weekday;
  }

  const index = typeof value.weekday === 'number' ? value.weekday : weekdayTokenToIndex(value.weekday);
  if (!Number.isInteger(index) || index < 0 || index > 6) {
    recurrenceError(TEMPORAL_ERROR_CODES.INVALID_OPTIONS, 'Invalid byDay value');
  }
  return value.ordinal ? new Weekday(index, value.ordinal) : new Weekday(index);
}

function toWkst(value: RecurrenceRuleInput['wkst']): Options['wkst'] {
  if (value === undefined || value === null) return null;
  if (typeof value === 'number') return value;
  const index = weekdayTokenToIndex(value);
  if (index < 0) recurrenceError(TEMPORAL_ERROR_CODES.INVALID_OPTIONS, `Invalid wkst value: ${value}`);
  return index;
}

function frequencyToCore(freq: RecurrenceFrequency): Options['freq'] {
  const frequencies: RecurrenceFrequency[] = ['YEARLY', 'MONTHLY', 'WEEKLY', 'DAILY', 'HOURLY', 'MINUTELY', 'SECONDLY'];
  const index = frequencies.indexOf(freq);
  if (index < 0) recurrenceError(TEMPORAL_ERROR_CODES.INVALID_OPTIONS, `Invalid freq value: ${freq}`);
  return index as Options['freq'];
}

export function toCoreRuleOptions(
  input: RecurrenceRuleInput,
  inheritedStart?: TemporalDateLike | null,
  inheritedTzid?: string | null,
) {
  const resolution = createTimezoneResolution(input.tzid ?? inheritedTzid);
  collectTemporalDateLikeTimezone(input.start ?? inheritedStart, resolution);
  collectTemporalDateLikeTimezone(input.until, resolution);
  const tzid = finalizeTzid(resolution) ?? null;
  const start = coerceTemporalDateLikeForTzid(input.start ?? inheritedStart, tzid);
  const until = coerceTemporalDateLikeForTzid(input.until, tzid);
  const coreInput: Partial<Options> = {
    freq: frequencyToCore(input.freq),
    dtstart: start?.date ?? (start === null ? null : undefined),
    interval: input.interval,
    count: input.count ?? undefined,
    until: until?.date ?? (until === null ? null : undefined),
    wkst: toWkst(input.wkst),
    tzid,
    bysetpos: input.bySetPos ?? null,
    bymonth: input.byMonth ?? null,
    bymonthday: input.byMonthDay ?? null,
    byyearday: input.byYearDay ?? null,
    byweekno: input.byWeekNo ?? null,
    byweekday: input.byDay === undefined || input.byDay === null
      ? null
      : (Array.isArray(input.byDay) ? input.byDay : [input.byDay]).map(toWeekday),
    byhour: input.byHour ?? null,
    byminute: input.byMinute ?? null,
    bysecond: input.bySecond ?? null,
    byeaster: input.byEaster ?? null,
    rscale: input.rscale ?? null,
    skip: input.skip ?? null,
  };

  const normalized = normalizeOptions(coreInput);
  const spec = buildRuleSpecFromResolvedTemporalOptions(normalized, {
    tzid: tzid ?? undefined,
    dtstart: start?.zonedDateTime ?? undefined,
    until: until?.zonedDateTime ?? undefined,
  });

  return {
    normalized,
    spec,
    tzid,
    start: start?.zonedDateTime ?? null,
    serialized: coreInput,
  };
}

export function coreOptionsToRuleInput(options: Partial<Options>): RecurrenceRuleInput {
  const byDay = options.byweekday === null || options.byweekday === undefined
    ? undefined
    : (Array.isArray(options.byweekday) ? options.byweekday : [options.byweekday]).map((value: ByWeekday) => {
      if (typeof value === 'number') return value;
      if (typeof value === 'string') return value as RecurrenceWeekdayValue;
      const token = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'][value.weekday] as RecurrenceWeekdayToken;
      return value.n ? { weekday: token, ordinal: value.n } : token;
    });

  return {
    freq: ['YEARLY', 'MONTHLY', 'WEEKLY', 'DAILY', 'HOURLY', 'MINUTELY', 'SECONDLY'][options.freq ?? 3] as RecurrenceFrequency,
    start: options.dtstart ?? undefined,
    tzid: options.tzid ?? undefined,
    interval: options.interval,
    count: options.count,
    until: options.until ?? undefined,
    wkst: typeof options.wkst === 'number' ? (['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'][options.wkst] as RecurrenceWeekdayToken) : undefined,
    bySetPos: options.bysetpos ?? undefined,
    byMonth: options.bymonth ?? undefined,
    byMonthDay: options.bymonthday ?? undefined,
    byYearDay: options.byyearday ?? undefined,
    byWeekNo: options.byweekno ?? undefined,
    byDay: byDay?.length === 1 ? byDay[0] : byDay,
    byHour: options.byhour ?? undefined,
    byMinute: options.byminute ?? undefined,
    bySecond: options.bysecond ?? undefined,
    byEaster: options.byeaster ?? undefined,
    rscale: options.rscale ?? undefined,
    skip: options.skip ?? undefined,
  };
}
