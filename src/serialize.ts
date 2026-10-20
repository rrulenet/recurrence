import { Temporal } from 'temporal-polyfill';
import { TEMPORAL_ERROR_CODES, recurrenceError } from './errors.ts';

function assertWholeSecond(value: Temporal.ZonedDateTime): void {
  if (value.epochNanoseconds % 1_000_000_000n) {
    recurrenceError(TEMPORAL_ERROR_CODES.UNSERIALIZABLE_EXPRESSION, 'RFC 5545 cannot preserve fractional seconds');
  }
}

export function formatCompactLocal(zdt: Temporal.ZonedDateTime): string {
  return `${String(zdt.year).padStart(4, '0')}${String(zdt.month).padStart(2, '0')}${String(zdt.day).padStart(2, '0')}T${String(zdt.hour).padStart(2, '0')}${String(zdt.minute).padStart(2, '0')}${String(zdt.second).padStart(2, '0')}`;
}

export function formatCompactUtc(zdt: Temporal.ZonedDateTime): string {
  const instant = zdt.toInstant().toString();
  return instant.replace(/[-:]/g, '').slice(0, 15) + 'Z';
}

export function renderDtstart(zdt: Temporal.ZonedDateTime): string {
  assertWholeSecond(zdt);
  if (Temporal.PlainDateTime.from(zdt.toPlainDateTime().toString()).toZonedDateTime(zdt.timeZoneId).epochNanoseconds !== zdt.epochNanoseconds) {
    recurrenceError(TEMPORAL_ERROR_CODES.UNSERIALIZABLE_EXPRESSION, 'Local DTSTART cannot preserve an explicit second overlap passage');
  }
  if (zdt.timeZoneId === 'UTC') return `DTSTART:${formatCompactUtc(zdt)}`;
  return `DTSTART;TZID=${zdt.timeZoneId}:${formatCompactLocal(zdt)}`;
}

export function renderDateList(label: 'RDATE' | 'EXDATE', dates: Temporal.ZonedDateTime[], tzid?: string | null): string {
  if (!dates.length) return '';
  dates.forEach(assertWholeSecond);
  let resolvedTzid = tzid ?? dates[0]!.timeZoneId;
  if (dates.some(value => {
    const local = value.withTimeZone(resolvedTzid);
    return Temporal.PlainDateTime.from(local.toPlainDateTime().toString()).toZonedDateTime(resolvedTzid).epochNanoseconds !== local.epochNanoseconds;
  })) resolvedTzid = 'UTC';
  const values = dates.map((date) => (
    resolvedTzid === 'UTC' ? formatCompactUtc(date) : formatCompactLocal(date.withTimeZone(resolvedTzid))
  ));
  return resolvedTzid === 'UTC'
    ? `${label}:${values.join(',')}`
    : `${label};TZID=${resolvedTzid}:${values.join(',')}`;
}
