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

test('modern yearly week number queries include a matching day in the preceding calendar year', () => {
  const rule = Recurrence.parse({ rruleString: 'DTSTART:20230101T090000Z\nRRULE:FREQ=YEARLY;BYWEEKNO=1;BYYEARDAY=366' });
  const days = values => values.map(value => value.toPlainDate().toString());
  const first = instant('2024-12-31T09:00:00Z');
  const second = instant('2036-12-31T09:00:00Z');
  assert.deepEqual(days(rule.take(2)), ['2024-12-31', '2036-12-31']);
  assert.deepEqual(days(rule.between(first, second, true)), ['2024-12-31', '2036-12-31']);
  assert.deepEqual(days([rule.after(first), rule.before(second)]), ['2036-12-31', '2024-12-31']);
  assert.equal(rule.occursAt(first), true);
});

test('DATE properties survive native JSON and edits while midnight DATE-TIME stays timed', () => {
  const tzid = 'America/Sao_Paulo';
  const text = [
    'DTSTART;VALUE=DATE:20181104',
    'RRULE:FREQ=DAILY;UNTIL=20181109',
    'RDATE;VALUE=DATE:20181110',
    'EXDATE:20181106T000000',
    'EXDATE;VALUE=DATE:20181107',
  ].join('\n');
  const recurrence = Recurrence.parse({ rruleString: text, tzid });
  assert.equal(recurrence.first().toPlainTime().toString(), '01:00:00');
  assert.equal(recurrence.toJSON().start, '2018-11-04');
  const restored = Recurrence.fromJSON(JSON.parse(JSON.stringify(recurrence)));
  const edited = recurrence.includingDates(['2018-11-11']);
  for (const value of [recurrence, restored, recurrence.clone(), edited]) {
    const output = value.toString();
    for (const line of ['DTSTART;VALUE=DATE:20181104', 'RDATE;VALUE=DATE:20181110',
      'EXDATE;VALUE=DATE:20181107', 'EXDATE;TZID=America/Sao_Paulo:20181106T000000']) {
      assert.ok(output.split('\n').includes(line), output);
    }
    assert.match(output, /UNTIL=20181109(?:;|\n)/);
    const roundTrip = Recurrence.parse({ rruleString: output, tzid });
    assert.deepEqual(roundTrip.all().map(date => date.epochNanoseconds), value.all().map(date => date.epochNanoseconds));
  }
});

test('hasAnyBetween and callback windows stop before a dense result breaches the budget', () => {
  const start = instant('2025-01-01T00:00:00Z');
  const second = start.add({ seconds: 1 });
  const end = start.add({ hours: 480 });
  const recurrence = Recurrence.rule({ freq: 'SECONDLY', start, tzid: 'UTC', count: 10_000_000 })
    .excludingDates([start]);
  assert.throws(() => recurrence.between(start, end, true), { code: 'RECURRENCE_SEARCH_LIMIT' });
  assert.equal(recurrence.hasAnyBetween(start, end, true), true);
  assert.equal(recurrence.hasAnyBetween(start, start, true), false);
  assert.equal(recurrence.hasAnyBetween(start, second, false), false);
  assert.equal(recurrence.hasAnyBetween(second, second, true), true);
  assert.equal(recurrence.hasAnyBetween(second, start, true), false);
  assert.deepEqual(recurrence.between(start, end, true, (_, index) => index < 1)
    .map(value => value.epochNanoseconds), [second.epochNanoseconds]);
});

test('takeAfter streams a named-zone COUNT through a gap, collisions and exclusions', () => {
  const recurrence = Recurrence.parse({ rruleString:
    'DTSTART;TZID=America/New_York:20260306T023000\nRRULE:FREQ=DAILY;BYHOUR=2,3;COUNT=8\nEXDATE;TZID=America/New_York:20260307T033000' });
  const boundary = instant('2026-03-07T07:30:00Z');
  assert.deepEqual(recurrence.takeAfter(boundary, 4).map(value => value.toInstant().toString()), [
    '2026-03-08T07:30:00Z',
    '2026-03-09T06:30:00Z',
    '2026-03-09T07:30:00Z',
    '2026-03-10T06:30:00Z',
  ]);
  assert.equal(recurrence.takeAfter(boundary, 1, true)[0].epochNanoseconds, boundary.epochNanoseconds);
  assert.deepEqual(recurrence.takeAfter(instant('2026-03-10T06:30:00Z'), 1), []);
});
