import test from 'node:test';
import assert from 'node:assert/strict';
import { Temporal } from 'temporal-polyfill';
import { Recurrence, elapsed, TEMPORAL_ERROR_CODES } from '../dist/index.mjs';

const instant = value => Temporal.Instant.from(value);
const utc = recurrence => recurrence.all().map(value => value.toInstant().toString());
const fold = ['2026-10-24T23:30:00Z', '2026-10-25T00:30:00Z', '2026-10-25T02:30:00Z', '2026-10-25T03:30:00Z'];
const grid = ['2026-10-24T23:30:00Z', '2026-10-25T00:30:00Z', '2026-10-25T01:30:00Z', '2026-10-25T02:30:00Z'];

test('calendar public constructors, RFC parsing, and JSON select the first autumn passage', () => {
  const rule = Recurrence.rule({freq: 'HOURLY', count: 4,
    start: Temporal.ZonedDateTime.from('2026-10-25T01:30:00+02:00[Europe/Paris]')});
  for (const value of [rule, Recurrence.fromJSON(rule.toJSON()), Recurrence.parse({rruleString: rule.toString()})]) {
    assert.deepEqual(utc(value), fold);
    assert.equal(value.occursAt(instant('2026-10-25T01:30:00Z')), false);
    assert.equal(value.after(instant(fold[1]), false)?.toInstant().toString(), fold[2]);
  }
});

test('calendar public daily rule retains nominal time after the spring gap', () => {
  const rule = Recurrence.rule({freq: 'DAILY', count: 3,
    start: Temporal.ZonedDateTime.from('2026-03-28T02:30:00+01:00[Europe/Paris]')});
  const expected = ['2026-03-28T01:30:00Z', '2026-03-29T01:30:00Z', '2026-03-30T00:30:00Z'];
  assert.deepEqual(utc(rule), expected);
  assert.deepEqual(utc(Recurrence.fromJSON(rule.toJSON())), expected);
});

test('elapsed public constructor and JSON retain both autumn passages and the exact anchor', () => {
  const rule = elapsed({start: instant(grid[0]), every: 'PT1H', tzid: 'Europe/Paris', count: 4});
  const json = JSON.parse(JSON.stringify(rule.toJSON()));
  assert.equal(json.temporalVersion, 2);
  assert.equal(json.include[0].elapsed.start, grid[0]);
  assert.equal(json.include[0].elapsed.every, 'PT3600S');
  for (const value of [rule, Recurrence.fromJSON(json), rule.normalize(), rule.flatten()]) {
    assert.deepEqual(utc(value), grid);
    assert.equal(value.occursAt(instant(grid[2])), true);
    assert.equal(value.after(instant(grid[1]), false)?.toInstant().toString(), grid[2]);
    assert.equal(value.before(instant(grid[2]), false)?.toInstant().toString(), grid[1]);
  }
});

test('elapsed presentation timezone does not change its grid across spring', () => {
  const expected = ['2026-03-29T00:30:00Z', '2026-03-29T01:00:00Z', '2026-03-29T01:30:00Z', '2026-03-29T02:00:00Z'];
  for (const tzid of ['UTC', 'Europe/Paris', 'Australia/Lord_Howe']) {
    assert.deepEqual(utc(Recurrence.elapsed({start: instant(expected[0]), every: 'PT30M', count: 4, tzid})), expected);
  }
});

test('elapsed UNTIL is inclusive and query bounds remain exact', () => {
  const rule = Recurrence.elapsed({start: instant(grid[0]), every: 'PT1H', until: instant(grid[2])});
  assert.deepEqual(utc(rule), grid.slice(0, 3));
  assert.equal(rule.after(instant(grid[2]), false), null);
  assert.deepEqual(rule.between(instant(grid[0]), instant(grid[2]), false).map(value => value.toInstant().toString()), [grid[1]]);
  assert.equal(rule.occursAt(instant('2026-10-25T00:30:00.5Z')), false);
});

test('elapsed algebra preserves phase, distinct instants, and source COUNT', () => {
  const rule = Recurrence.elapsed({start: instant(grid[0]), every: 'PT1H', count: 4});
  const excluded = rule.excludingDates([instant(grid[1])]);
  assert.deepEqual(utc(excluded), [grid[0], grid[2], grid[3]]);
  assert.deepEqual(utc(Recurrence.fromJSON(excluded.toJSON())), [grid[0], grid[2], grid[3]]);
  const intersection = rule.intersection(Recurrence.dates([instant(grid[1]), instant(grid[2])]));
  assert.deepEqual(utc(Recurrence.fromJSON(intersection.toJSON())), grid.slice(1, 3));
});

test('simple elapsed RFC export is a lossless UTC rule', () => {
  const rule = Recurrence.elapsed({start: instant(grid[0]), every: 'PT1H', count: 4, tzid: 'Europe/Paris'});
  assert.match(rule.toString(), /^DTSTART:20261024T233000Z\nRRULE:FREQ=SECONDLY;INTERVAL=3600;COUNT=4$/);
  assert.deepEqual(utc(Recurrence.parse({rruleString: rule.toString()})), grid);
  assert.throws(() => rule.includingDates([instant('2026-10-25T04:00:00Z')]).toString(),
    error => error.code === TEMPORAL_ERROR_CODES.UNSERIALIZABLE_EXPRESSION);
});

test('elapsed validation rejects calendar durations, subsecond steps, missing anchors and hidden filters', () => {
  for (const every of ['P1D', 'P1M', 'PT0S', '-PT1H', 'PT0.5S']) {
    assert.throws(() => Recurrence.elapsed({start: instant(grid[0]), every}), error => error.code === TEMPORAL_ERROR_CODES.INVALID_OPTIONS);
  }
  assert.throws(() => Recurrence.elapsed({every: 'PT1H'}));
  assert.throws(() => Recurrence.elapsed({start: instant(grid[0]), every: 'PT1H', byHour: [2]}));
  assert.throws(() => Recurrence.elapsed({start: instant(grid[0]), every: 'PT1H', count: 2, until: instant(grid[3])}));
});

test('legacy JSON needs an explicit calendar migration and unknown temporal versions fail', () => {
  const rule = Recurrence.rule({freq: 'HOURLY', count: 4, start: instant(grid[0]), tzid: 'Europe/Paris'});
  const legacy = JSON.parse(JSON.stringify(rule.toJSON()));
  delete legacy.temporalVersion;
  assert.equal(Recurrence.validateJSON(legacy).ok, false);
  assert.throws(() => Recurrence.fromJSON(legacy), error => error.code === TEMPORAL_ERROR_CODES.UNSUPPORTED_TEMPORAL_VERSION);
  assert.deepEqual(utc(Recurrence.fromJSON(legacy, {legacy: 'calendar'})), fold);
  assert.equal(Recurrence.fromJSON(legacy, {legacy: 'calendar'}).toJSON().temporalVersion, 2);
  assert.throws(() => Recurrence.fromJSON({...legacy, temporalVersion: 99}, {legacy: 'calendar'}));
  assert.throws(() => Recurrence.fromJSON({temporalVersion: 2, kind: 'union', expressions: [legacy]}));
});

test('native exact overlap starts and dates are preserved without a lossy local RFC export', () => {
  const second = instant(grid[2]);
  const rule = Recurrence.rule({freq: 'DAILY', count: 1, byHour: [2], byMinute: [30],
    start: second.toZonedDateTimeISO('Europe/Paris')});
  assert.equal(rule.first().toInstant().toString(), '2026-10-26T01:30:00Z');
  assert.throws(() => rule.toString(), error => error.code === TEMPORAL_ERROR_CODES.UNSERIALIZABLE_EXPRESSION);
  const dates = Recurrence.dates([second], {tzid: 'Europe/Paris'});
  assert.match(dates.toString(), /RDATE:20261025T013000Z/);
  assert.deepEqual(utc(Recurrence.parse({rruleString: dates.toString()})), [grid[2]]);
});

test('elapsed arbitrary exact start precision is preserved in JSON and rejected by RFC export', () => {
  const start = instant('2026-10-25T00:30:00.123456789Z');
  const rule = Recurrence.elapsed({start, every: 'PT1S', count: 2});
  assert.deepEqual(utc(Recurrence.fromJSON(rule.toJSON())),
    ['2026-10-25T00:30:00.123456789Z', '2026-10-25T00:30:01.123456789Z']);
  assert.throws(() => rule.toString(), error => error.code === TEMPORAL_ERROR_CODES.UNSERIALIZABLE_EXPRESSION);
  assert.equal(rule.occursAt(instant('2026-10-25T00:30:00.123456789Z')), true);
  assert.equal(rule.occursAt(instant('2026-10-25T00:30:00.123Z')), false);
});

test('calendar JSON preserves an exact native start and UNTIL finer than milliseconds', () => {
  const rule = Recurrence.rule({freq: 'SECONDLY',
    start: instant('2026-03-28T00:00:00.123456789Z'), until: instant('2026-03-28T00:00:01.123456789Z')});
  assert.deepEqual(utc(Recurrence.fromJSON(JSON.parse(JSON.stringify(rule.toJSON())))),
    ['2026-03-28T00:00:00.123456789Z', '2026-03-28T00:00:01.123456789Z']);
  assert.throws(() => rule.toString(), error => error.code === TEMPORAL_ERROR_CODES.UNSERIALIZABLE_EXPRESSION);
});
