import { Temporal } from 'temporal-polyfill';

export function formatCompactLocal(zdt: Temporal.ZonedDateTime): string {
  return `${String(zdt.year).padStart(4, '0')}${String(zdt.month).padStart(2, '0')}${String(zdt.day).padStart(2, '0')}T${String(zdt.hour).padStart(2, '0')}${String(zdt.minute).padStart(2, '0')}${String(zdt.second).padStart(2, '0')}`;
}

export function formatCompactUtc(zdt: Temporal.ZonedDateTime): string {
  const instant = zdt.toInstant().toString();
  return instant.replace(/[-:]/g, '').slice(0, 15) + 'Z';
}

export function renderDtstart(zdt: Temporal.ZonedDateTime): string {
  if (zdt.timeZoneId === 'UTC') return `DTSTART:${formatCompactUtc(zdt)}`;
  return `DTSTART;TZID=${zdt.timeZoneId}:${formatCompactLocal(zdt)}`;
}

export function renderDateList(label: 'RDATE' | 'EXDATE', dates: Temporal.ZonedDateTime[], tzid?: string | null): string {
  if (!dates.length) return '';
  const resolvedTzid = tzid ?? dates[0]!.timeZoneId;
  const values = dates.map((date) => (
    resolvedTzid === 'UTC' ? formatCompactUtc(date) : formatCompactLocal(date.withTimeZone(resolvedTzid))
  ));
  return resolvedTzid === 'UTC'
    ? `${label}:${values.join(',')}`
    : `${label};TZID=${resolvedTzid}:${values.join(',')}`;
}
