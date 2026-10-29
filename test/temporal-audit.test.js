import test from 'node:test';
import assert from 'node:assert/strict';
import { Temporal } from 'temporal-polyfill';
import { Recurrence } from '../dist/index.mjs';

const instant = value => Temporal.Instant.from(value);

test('modern parsing preserves quoted local leap-day DTSTART through native JSON', () => {
  const rule = Recurrence.parse({ rruleString: 'DTSTART;VALUE=DATE-TIME;TZID="America/New_York":20240229T090000\nRRULE:FREQ=YEARLY;COUNT=2' });
  for (const value of [rule, Recurrence.fromJSON(rule.toJSON())]) {
    assert.deepEqual(value.all().map(date => date.toInstant().toString()), ['2024-02-29T14:00:00Z', '2028-02-29T14:00:00Z']);
  }
});

test('take() streams beyond previews with exceptions and remains ordered', () => {
  const rule = Recurrence.rule({ freq: 'DAILY', start: instant('2025-01-01T09:00:00Z') })
    .includingDates([instant('2025-01-01T09:00:00Z')]).excludingDates([instant('2025-01-02T09:00:00Z')]);
  const values = rule.take(1000);
  assert.equal(values.length, 1000);
  assert.equal(values[1].toInstant().toString(), '2025-01-03T09:00:00Z');
  assert.equal(rule.before(instant('2050-01-01T09:00:00Z'), true).toInstant().toString(), '2050-01-01T09:00:00Z');
});

test('first() stops within a dense annual period', () => {
  const rule = Recurrence.rule({ freq: 'YEARLY', start: instant('2025-01-01T00:00:00Z'),
    byMonth: Array.from({ length: 12 }, (_, i) => i + 1), byMonthDay: Array.from({ length: 31 }, (_, i) => i + 1),
    byHour: Array.from({ length: 24 }, (_, i) => i), byMinute: Array.from({ length: 60 }, (_, i) => i),
    bySecond: Array.from({ length: 60 }, (_, i) => i) });
  assert.equal(rule.first().toInstant().toString(), '2025-01-01T00:00:00Z');
});
