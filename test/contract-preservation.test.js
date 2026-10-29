import test from 'node:test';
import assert from 'node:assert/strict';
import { Temporal } from 'temporal-polyfill';
import { Recurrence } from '../dist/index.mjs';

const instant = value => Temporal.Instant.from(value);
const stamps = values => values.map(value => value.epochNanoseconds);
const restored = value => Recurrence.fromJSON(JSON.parse(JSON.stringify(value.toJSON())));

test('streamed algebra retains an explicit second fold instant and does not refill calendar COUNT', () => {
  const first = instant('2026-10-25T00:30:00Z');
  const second = instant('2026-10-25T01:30:00Z');
  const recurrence = Recurrence.rule({ freq: 'DAILY', count: 3, tzid: 'Europe/Paris',
    start: instant('2026-10-24T00:30:00Z') }).includingDates([second]).excludingDates([first]);
  const expected = ['2026-10-24T00:30:00Z', '2026-10-25T01:30:00Z', '2026-10-26T01:30:00Z'].map(instant);
  for (const value of [recurrence, restored(recurrence)]) {
    assert.equal(value.first().epochNanoseconds, expected[0].epochNanoseconds);
    assert.deepEqual(stamps(value.take(1)), stamps(expected.slice(0, 1)));
    assert.deepEqual(stamps(value.take(10)), stamps(expected));
    assert.deepEqual(stamps(value.all()), stamps(expected));
    assert.equal(value.after(expected[0], false).epochNanoseconds, second.epochNanoseconds);
    assert.equal(value.before(expected[2], false).epochNanoseconds, second.epochNanoseconds);
    assert.equal(value.occursAt(first), false);
    assert.equal(value.occursAt(second), true);
  }
});

test('elapsed streaming, cancellation and JSON retain exact phase independently of display timezone', () => {
  const start = instant('2026-10-24T23:10:00.123456789Z');
  const grid = Array.from({ length: 8 }, (_, index) => start.add({ minutes: 40 * index }));
  const extra = grid[3].add({ nanoseconds: 1 });
  const expected = [...grid.filter((_, index) => index !== 2), extra]
    .sort((a, b) => Temporal.Instant.compare(a, b));
  for (const tzid of ['UTC', 'Europe/Paris', 'Australia/Lord_Howe']) {
    const recurrence = Recurrence.elapsed({ start, every: 'PT40M', count: 8, tzid })
      .excludingDates([grid[2]]).includingDates([extra]);
    for (const value of [recurrence, restored(recurrence)]) {
      assert.deepEqual(stamps(value.take(1)), stamps(expected.slice(0, 1)));
      assert.deepEqual(stamps(value.take(20)), stamps(expected));
      assert.deepEqual(stamps(value.all()), stamps(expected));
      assert.equal(value.after(grid[3], false).epochNanoseconds, extra.epochNanoseconds);
      assert.equal(value.before(extra, false).epochNanoseconds, grid[3].epochNanoseconds);
      assert.equal(value.after(expected.at(-1), false), null);
      assert.equal(value.occursAt(grid[2]), false);
    }
  }
});
