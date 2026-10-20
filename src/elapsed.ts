import { ElapsedSource } from '@rrulenet/core/engine';
import { Temporal } from 'temporal-polyfill';
import { TEMPORAL_ERROR_CODES, recurrenceError } from './errors.ts';
import { coerceBoundary, isPlainObject } from './temporal-coercion.ts';
import type { RecurrenceElapsedInput } from './types.ts';

export type ElapsedEntryState = {
  kind: 'elapsed';
  source: ElapsedSource;
  options: RecurrenceElapsedInput;
};

export function elapsedEntry(input: RecurrenceElapsedInput, inheritedTzid?: string | null): ElapsedEntryState {
  try {
    if (!isPlainObject(input) || !input.start) throw new RangeError('elapsed requires an exact start');
    for (const key of Object.keys(input)) {
      if (!['start', 'every', 'tzid', 'count', 'until'].includes(key)) throw new RangeError(`Unsupported elapsed option: ${key}`);
    }
    const start = coerceBoundary(input.start);
    const until = input.until == null ? undefined : coerceBoundary(input.until);
    const source = new ElapsedSource({
      start, every: input.every, tzid: input.tzid ?? inheritedTzid ?? 'UTC',
      count: input.count ?? undefined, until,
    });
    const options: RecurrenceElapsedInput = {
      start, every: `PT${source.seconds}S`, tzid: source.spec.tzid,
      ...(source.spec.count !== undefined ? { count: source.spec.count } : {}),
      ...(until ? { until } : {}),
    };
    return { kind: 'elapsed' as const, source, options };
  } catch (error) {
    recurrenceError(TEMPORAL_ERROR_CODES.INVALID_OPTIONS, `Invalid elapsed cadence: ${(error as Error).message}`);
  }
}

export function elapsedRfc(source: ElapsedSource): string {
  const { start, count, until } = source.spec;
  if (start.epochNanoseconds % 1_000_000_000n || (until && until.epochNanoseconds % 1_000_000_000n) || count === 0) {
    recurrenceError(TEMPORAL_ERROR_CODES.UNSERIALIZABLE_EXPRESSION, 'This elapsed cadence cannot be represented exactly in RFC 5545');
  }
  const compact = (value: Temporal.Instant) => value.toString().replace(/[-:]/g, '');
  return `DTSTART:${compact(start)}\nRRULE:FREQ=SECONDLY;INTERVAL=${source.seconds}` +
    (count !== undefined ? `;COUNT=${count}` : '') + (until ? `;UNTIL=${compact(until)}` : '');
}
