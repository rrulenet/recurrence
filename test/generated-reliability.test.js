import test from 'node:test';
import assert from 'node:assert/strict';
import { Temporal } from 'temporal-polyfill';
import { Recurrence } from '../dist/index.mjs';

test('generated native JSON and set algebra agree with independent finite sets', () => {
  let state = 0x20261027;
  const random = max => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return (state >>> 8) % max; };
  const start = Date.parse('2026-10-24T23:30:00Z');
  const ordered = values => [...new Set(values)].sort((a, b) => a - b);
  const dates = values => Recurrence.dates(values.map(value => Temporal.Instant.fromEpochMilliseconds(value)));
  for (let index = 0; index < 64; index++) {
    const left = ordered(Array.from({ length: 1 + random(6) }, () => start + random(12) * 1800000));
    const right = ordered(Array.from({ length: 1 + random(6) }, () => start + random(12) * 1800000));
    const a = dates(left), b = dates(right);
    for (const [expression, expected] of [
      [a.union(b), ordered([...left, ...right])],
      [a.intersection(b), left.filter(value => right.includes(value))],
      [a.difference(b), left.filter(value => !right.includes(value))],
      [a.union(b).difference(a), right.filter(value => !left.includes(value))],
      [a.union(a), left], [a.intersection(a), left], [a.difference(a), []],
    ]) {
      for (const recurrence of [expression, Recurrence.fromJSON(expression.toJSON())]) {
        assert.deepEqual(recurrence.all().map(value => value.epochMilliseconds), expected, `case=${index}`);
        const boundary = Temporal.Instant.fromEpochMilliseconds(start + 4 * 1800000);
        assert.equal(recurrence.after(boundary, true)?.epochMilliseconds ?? null, expected.find(value => value >= boundary.epochMilliseconds) ?? null);
        assert.equal(recurrence.before(boundary, false)?.epochMilliseconds ?? null, expected.filter(value => value < boundary.epochMilliseconds).at(-1) ?? null);
      }
    }
  }
});
