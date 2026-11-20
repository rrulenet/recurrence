import test from 'node:test';
import assert from 'node:assert/strict';
import { Temporal } from 'temporal-polyfill';
import { Recurrence } from '../dist/index.mjs';

test('modern facade preserves annual positions through native JSON, RFC and exclusions', () => {
  const rule = Recurrence.rule({ freq: 'YEARLY', start: Temporal.Instant.from('2026-01-01T09:00:00Z'),
    byMonth: [2, 1, 1], byMonthDay: [1], bySetPos: [1], count: 3 });
  const expected = ['2026-01-01T09:00:00Z', '2027-01-01T09:00:00Z', '2028-01-01T09:00:00Z'];
  for (const value of [rule, Recurrence.fromJSON(rule.toJSON()), Recurrence.parse({ rruleString: rule.toString() })]) {
    assert.deepEqual(value.all().map(date => date.toInstant().toString()), expected);
    assert.deepEqual(value.difference(Recurrence.dates([Temporal.Instant.from(expected[0])])).all().map(date => date.toInstant().toString()), expected.slice(1));
  }
});

test('modern facade rejects malformed RFC numeric lists and exposes search exhaustion', () => {
  for (const token of ['9,,10', '0xA', '1e1']) {
    assert.throws(() => Recurrence.parse({ rruleString: `DTSTART:20260101T090000Z\nRRULE:FREQ=DAILY;BYHOUR=${token}` }), RangeError);
  }
  const empty = Recurrence.rule({ freq: 'MINUTELY', start: Temporal.Instant.from('2026-07-08T08:27:55Z'),
    interval: 10, byMinute: [0, 10, 20, 30, 40, 50] });
  assert.equal(empty.after(Temporal.Instant.from('2026-07-08T08:27:55Z'), false), null);
  const impossible = Recurrence.rule({ freq: 'YEARLY', start: Temporal.Instant.from('2026-01-01T09:00:00Z'),
    byMonth: [2], byMonthDay: [30], count: 1 });
  assert.equal(impossible.first(), null);
  const unresolved = Recurrence.rule({ ...impossible.toInput().include[0].rule, freq: 'MONTHLY' });
  assert.throws(() => unresolved.all(), error => error.code === 'RECURRENCE_SEARCH_LIMIT');
});
