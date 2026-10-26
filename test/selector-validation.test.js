import test from 'node:test';
import assert from 'node:assert/strict';
import { Temporal } from 'temporal-polyfill';
import { Recurrence } from '../dist/index.mjs';

const start = Temporal.ZonedDateTime.from('2026-01-01T00:00:00Z[UTC]');

test('modern facade: invalid selectors are rejected through rule, parse and JSON ingestion', () => {
  for (const [key, value] of Object.entries({ byHour: 25, byMinute: 60, bySecond: 61, byMonth: 13, byMonthDay: 32 })) {
    const rule = { freq: 'DAILY', count: 2, start, [key]: value };
    const json = Recurrence.rule({ freq: 'DAILY', count: 2, start }).toJSON();
    json.include[0].rule[key] = value;
    for (const create of [
      () => Recurrence.rule(rule),
      () => new Recurrence({ include: [{ rule }] }),
      () => new Recurrence({ include: [{ dates: [start] }], exclude: [{ rule }] }),
      () => Recurrence.parse({ rruleString: `DTSTART:20260101T000000Z\nRRULE:FREQ=DAILY;COUNT=2;${key.toUpperCase()}=${value}` }),
      () => Recurrence.fromJSON(json),
    ]) assert.throws(create, error => error instanceof RangeError && error.message.includes(key.toUpperCase()));
    assert.equal(Recurrence.isJSON(json), false);
    const result = Recurrence.validateJSON(json);
    assert.equal(result.ok, false);
    assert(result.error instanceof RangeError);
  }
});

test('modern facade: second 60 uses the fallback consistently through JSON and RFC', () => {
  const recurrence = Recurrence.rule({ freq: 'MINUTELY', start: start.with({ second: 59 }), count: 3, bySecond: [59, 60] });
  const expected = ['2026-01-01T00:00:59Z', '2026-01-01T00:01:59Z', '2026-01-01T00:02:59Z'];
  for (const value of [recurrence, Recurrence.fromJSON(recurrence.toJSON()), Recurrence.parse({ rruleString: recurrence.toString() })]) {
    assert.deepEqual(value.all().map(date => date.toInstant().toString()), expected);
  }
});
