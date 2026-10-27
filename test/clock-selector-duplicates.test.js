import test from 'node:test';
import assert from 'node:assert/strict';
import { Temporal } from 'temporal-polyfill';
import { Recurrence } from '../dist/index.mjs';

test('modern facade: duplicate clock members preserve distinct positions through native JSON and RFC', () => {
  const byHour = Object.freeze([10, 9, 9]);
  const byMinute = Object.freeze([30, 0, 0]);
  const recurrence = Recurrence.rule({ freq: 'DAILY', start: Temporal.ZonedDateTime.from('2026-01-01T09:00:00Z[UTC]'),
    count: 4, byHour, byMinute, bySetPos: [3, -3] });
  const expected = ['2026-01-01T09:30:00Z', '2026-01-01T10:00:00Z',
    '2026-01-02T09:30:00Z', '2026-01-02T10:00:00Z'];
  for (const value of [recurrence, Recurrence.fromJSON(recurrence.toJSON()), Recurrence.parse({ rruleString: recurrence.toString() })]) {
    assert.deepEqual(value.all().map(date => date.toInstant().toString()), expected);
    assert.equal(value.after(Temporal.Instant.from(expected[1]), false)?.toInstant().toString(), expected[2]);
    assert.equal(value.before(Temporal.Instant.from(expected[2]), false)?.toInstant().toString(), expected[1]);
  }
  const json = recurrence.toJSON();
  assert.deepEqual(json.include[0].rule.byHour, [10, 9, 9]);
  assert.deepEqual(json.include[0].rule.byMinute, [30, 0, 0]);
  assert.deepEqual(byHour, [10, 9, 9]);
  assert.deepEqual(byMinute, [30, 0, 0]);
});
