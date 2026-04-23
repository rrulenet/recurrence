import { Temporal } from 'temporal-polyfill';

import { TEMPORAL_ERROR_CODES, recurrenceError } from './errors.ts';
import type { TemporalDateLike, TemporalInstantLike, TemporalZonedDateTimeLike } from './types.ts';

export type TimezoneResolution = {
  explicitTzid?: string | null;
  inferredTzid?: string | null;
};

export type CoercedTemporalDateLike = {
  date: Date;
  zonedDateTime: Temporal.ZonedDateTime;
};

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!isObject(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function validateOptionsObject(
  value: unknown,
  context: 'constructor' | 'parse' | 'rule' | 'dates',
): asserts value is Record<string, unknown> | undefined {
  if (value === undefined) return;
  if (isPlainObject(value)) return;
  const label = context === 'constructor' ? 'new Recurrence()' : `Recurrence.${context}()`;
  recurrenceError(TEMPORAL_ERROR_CODES.INVALID_OPTIONS, `${label} expects a plain options object`);
}

export function isTemporalInstantLike(value: unknown): value is TemporalInstantLike {
  if (!isObject(value) || typeof value.epochMilliseconds !== 'number' || typeof value.toString !== 'function') {
    return false;
  }

  try {
    const instant = Temporal.Instant.from(value.toString());
    return instant.epochMilliseconds === value.epochMilliseconds
      && typeof (value as Record<string, unknown>).toZonedDateTimeISO === 'function'
      && !('timeZoneId' in value);
  } catch {
    return false;
  }
}

export function isTemporalZonedDateTimeLike(value: unknown): value is TemporalZonedDateTimeLike {
  if (
    !isObject(value)
    || typeof value.epochMilliseconds !== 'number'
    || typeof value.timeZoneId !== 'string'
    || typeof value.toInstant !== 'function'
    || typeof value.toString !== 'function'
  ) {
    return false;
  }

  try {
    const zdt = Temporal.ZonedDateTime.from(value.toString());
    return zdt.epochMilliseconds === value.epochMilliseconds && zdt.timeZoneId === value.timeZoneId;
  } catch {
    return false;
  }
}

export function validateTzid(tzid: string) {
  try {
    Temporal.Instant.fromEpochMilliseconds(0).toZonedDateTimeISO(tzid);
  } catch {
    recurrenceError(TEMPORAL_ERROR_CODES.INVALID_TZID, 'Invalid tzid');
  }
}

export function createTimezoneResolution(tzid?: string | null): TimezoneResolution {
  if (tzid !== undefined && tzid !== null) validateTzid(tzid);
  return { explicitTzid: tzid };
}

export function resolveTzid(nextTzid: string, resolution: TimezoneResolution): string {
  validateTzid(nextTzid);

  if (resolution.explicitTzid && resolution.explicitTzid !== nextTzid) {
    recurrenceError(TEMPORAL_ERROR_CODES.TZID_CONTRADICTION, 'ZonedDateTime versus tzid contradiction');
  }

  if (resolution.inferredTzid && resolution.inferredTzid !== nextTzid) {
    recurrenceError(
      TEMPORAL_ERROR_CODES.CONFLICTING_ZONED_DATETIMES,
      'Multiple conflicting ZonedDateTime values in one call',
    );
  }

  resolution.inferredTzid = nextTzid;
  return nextTzid;
}

export function finalizeTzid(resolution: TimezoneResolution): string | null | undefined {
  if (resolution.explicitTzid !== undefined && resolution.explicitTzid !== null) {
    validateTzid(resolution.explicitTzid);
    return resolution.explicitTzid;
  }
  return resolution.inferredTzid;
}

export function collectTemporalDateLikeTimezone(
  value: TemporalDateLike | null | undefined,
  resolution: TimezoneResolution,
): void {
  if (value === undefined || value === null || value instanceof Date || isTemporalInstantLike(value)) return;
  if (isTemporalZonedDateTimeLike(value)) {
    resolveTzid(value.timeZoneId, resolution);
    return;
  }
  recurrenceError(TEMPORAL_ERROR_CODES.UNSUPPORTED_INPUT, 'Unsupported Temporal input kind');
}

export function coerceTemporalDateLikeForTzid(
  value: TemporalDateLike | null | undefined,
  tzid?: string | null,
): CoercedTemporalDateLike | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) recurrenceError(TEMPORAL_ERROR_CODES.INVALID_DATE, 'Invalid date');
    const date = new Date(value.getTime());
    const resolvedTzid = tzid ?? 'UTC';
    return {
      date,
      zonedDateTime: Temporal.Instant.fromEpochMilliseconds(date.getTime()).toZonedDateTimeISO(resolvedTzid),
    };
  }

  if (isTemporalZonedDateTimeLike(value)) {
    const resolvedTzid = tzid ?? value.timeZoneId;
    const zonedDateTime = Temporal.Instant
      .fromEpochMilliseconds(value.toInstant().epochMilliseconds)
      .toZonedDateTimeISO(resolvedTzid);
    return {
      date: new Date(zonedDateTime.epochMilliseconds),
      zonedDateTime,
    };
  }

  if (isTemporalInstantLike(value)) {
    if (Number.isNaN(value.epochMilliseconds)) {
      recurrenceError(TEMPORAL_ERROR_CODES.UNSUPPORTED_INPUT, 'Unsupported Temporal input kind');
    }
    const date = new Date(value.epochMilliseconds);
    const resolvedTzid = tzid ?? 'UTC';
    return {
      date,
      zonedDateTime: Temporal.Instant.fromEpochMilliseconds(value.epochMilliseconds).toZonedDateTimeISO(resolvedTzid),
    };
  }

  recurrenceError(TEMPORAL_ERROR_CODES.UNSUPPORTED_INPUT, 'Unsupported Temporal input kind');
}

export function coerceBoundary(value: TemporalDateLike, tzid?: string | null): Temporal.Instant {
  const coerced = coerceTemporalDateLikeForTzid(value, tzid);
  if (!coerced) recurrenceError(TEMPORAL_ERROR_CODES.INVALID_DATE, 'Invalid date');
  return coerced.zonedDateTime.toInstant();
}
