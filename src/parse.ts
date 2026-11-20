import { groomRuleOptions, parseRRuleStringComponents } from '@rrulenet/core';
import type { Recurrence } from './Recurrence.ts';
import { buildState } from './state.ts';
import { coreOptionsToRuleInput } from './rules.ts';
import { collectTemporalDateLikeTimezone, coerceTemporalDateLikeForTzid, createTimezoneResolution, finalizeTzid, validateOptionsObject } from './temporal-coercion.ts';
import type { RecurrenceEntry, RecurrenceParseOptions } from './types.ts';
import { TEMPORAL_ERROR_CODES, recurrenceError } from './errors.ts';

export function recurrenceFromParsedOptions(options: RecurrenceParseOptions, fromState: (state: ReturnType<typeof buildState>) => Recurrence): Recurrence {
  validateOptionsObject(options, 'parse');
  if (!options.rruleString || !options.rruleString.trim()) {
    recurrenceError(TEMPORAL_ERROR_CODES.INVALID_RRULE_STRING, 'Missing or empty rruleString');
  }

  const resolution = createTimezoneResolution(options.tzid);
  collectTemporalDateLikeTimezone(options.start, resolution);
  collectTemporalDateLikeTimezone(options.until, resolution);
  const start = coerceTemporalDateLikeForTzid(options.start, finalizeTzid(resolution));
  const until = coerceTemporalDateLikeForTzid(options.until, finalizeTzid(resolution));

  const parsed = parseRRuleStringComponents(options.rruleString, {
    dtstart: start?.date ?? (start === null ? null : undefined),
    until: until?.date ?? (until === null ? null : undefined),
    tzid: finalizeTzid(resolution) ?? null,
    count: options.count,
    cache: options.cache,
    unfold: options.unfold,
    forceset: options.forceset,
    compatible: options.compatible,
  });

  const reinterpretExternalDtstart = Boolean(
    parsed.rawOptions.dtstart && !parsed.rawOptions.tzid && parsed.tzid && !parsed.sawInlineDtstart,
  );

  const include: RecurrenceEntry[] = [];
  const exclude: RecurrenceEntry[] = [];

  for (const value of parsed.rruleValues) {
    const groomed = groomRuleOptions(
      value,
      parsed.dtstart,
      parsed.tzid,
      parsed.rawOptions.count,
      parsed.rawOptions.until,
      reinterpretExternalDtstart,
      parsed.dtstartDate,
    );
    include.push({ rule: coreOptionsToRuleInput(groomed) });
  }

  for (const value of parsed.exruleValues) {
    const groomed = groomRuleOptions(
      value,
      parsed.dtstart,
      parsed.tzid,
      parsed.rawOptions.count,
      parsed.rawOptions.until,
      reinterpretExternalDtstart,
      parsed.dtstartDate,
    );
    exclude.push({ rule: coreOptionsToRuleInput(groomed) });
  }

  const includeDates = parsed.rdateValues.map((value, index) => parsed.rdatePlainDates[index] ?? value);
  if (parsed.rawOptions.compatible && parsed.dtstart) includeDates.push(parsed.dtstartDate ?? parsed.dtstart);
  if (includeDates.length) include.push({ dates: includeDates });
  if (parsed.exdateValues.length) exclude.push({
    dates: parsed.exdateValues.map((value, index) => parsed.exdatePlainDates[index] ?? value),
  });

  if (!include.length && parsed.dtstart) {
    include.push({ dates: [parsed.dtstartDate ?? parsed.dtstart] });
  }

  return fromState(buildState({
    start: parsed.dtstartDate ?? parsed.dtstart,
    tzid: parsed.tzid,
    include,
    exclude,
  }));
}
