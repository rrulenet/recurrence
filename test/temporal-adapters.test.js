import test from 'node:test';
import assert from 'node:assert/strict';
import { Temporal } from 'temporal-polyfill';
import { Recurrence, TemporalApiError, TEMPORAL_ERROR_CODES } from '../dist/index.mjs';

// Deliberately implement only the published structural ZonedDateTime contract.
const zonedLike = value => {
  const zoned = Temporal.ZonedDateTime.from(value);
  return {
    epochMilliseconds: zoned.epochMilliseconds,
    timeZoneId: zoned.timeZoneId,
    toInstant: () => ({ epochMilliseconds: zoned.epochMilliseconds }),
    toString: () => value,
  };
};

test('minimal zoned adapters remain valid calendar starts, bounds, and explicit dates', () => {
  const start = zonedLike('2026-01-01T09:00:00+01:00[Europe/Paris]');
  const until = zonedLike('2026-01-02T09:00:00+01:00[Europe/Paris]');
  const rule = Recurrence.rule({ freq: 'DAILY', start, until });
  assert.deepEqual(rule.all().map(value => value.toInstant().toString()), [
    '2026-01-01T08:00:00Z', '2026-01-02T08:00:00Z',
  ]);
  assert.equal(rule.after(start, true)?.toInstant().toString(), '2026-01-01T08:00:00Z');
  assert.equal(rule.before(until, true)?.toInstant().toString(), '2026-01-02T08:00:00Z');
  assert.equal(rule.between(start, until, true).length, 2);
  assert.equal(rule.occursAt(start), true);
  assert.equal(Recurrence.dates([start]).first()?.toInstant().toString(), '2026-01-01T08:00:00Z');
});

test('elapsed adapters retain the exact second passage independently of presentation timezone', () => {
  const start = zonedLike('2026-10-25T02:30:00+01:00[Europe/Paris]');
  const until = zonedLike('2026-10-25T03:30:00+01:00[Europe/Paris]');
  const cadence = Recurrence.elapsed({ start, until, every: 'PT30M', tzid: 'America/New_York' });
  assert.deepEqual(cadence.all().map(value => value.toInstant().toString()), [
    '2026-10-25T01:30:00Z', '2026-10-25T02:00:00Z', '2026-10-25T02:30:00Z',
  ]);
  assert.equal(cadence.occursAt(start), true);
  assert.equal(cadence.after(until, false), null);
  assert.equal(cadence.first().timeZoneId, 'America/New_York');
});

test('canonical adapter strings preserve nanoseconds through queries and JSON', () => {
  const start = zonedLike('2026-03-29T01:59:59.123456789+01:00[Europe/Paris]');
  for (const recurrence of [
    Recurrence.rule({ freq: 'SECONDLY', start, count: 2 }),
    Recurrence.elapsed({ start, every: 'PT1S', count: 2 }),
  ]) {
    const restored = Recurrence.fromJSON(JSON.parse(JSON.stringify(recurrence.toJSON())));
    assert.equal(restored.first()?.toInstant().toString(), '2026-03-29T00:59:59.123456789Z');
    assert.equal(restored.occursAt(start), true);
    assert.equal(restored.occursAt(Temporal.Instant.from('2026-03-29T00:59:59.123Z')), false);
  }
});

for (const [name, create] of [
  ['rule', options => Recurrence.rule(options)],
  ['constructor', options => new Recurrence({ include: [{ rule: options }] })],
  ['parse', () => Recurrence.parse({ rruleString: 'DTSTART:20260101T000000Z\nRRULE:FREQ=DAILY;COUNT=2;UNTIL=20260103T000000Z' })],
  ['JSON', () => Recurrence.fromJSON({ temporalVersion: 2, kind: 'input', start: null, tzid: 'UTC',
    include: [{ rule: { freq: 'DAILY', start: '2026-01-01T00:00:00Z', count: 2, until: '2026-01-03T00:00:00Z' } }], exclude: [] })],
]) {
  test(`COUNT with UNTIL produces a typed public error through ${name}`, () => {
    assert.throws(() => create({ freq: 'DAILY', start: Temporal.Instant.from('2026-01-01T00:00:00Z'),
      count: 2, until: Temporal.Instant.from('2026-01-03T00:00:00Z') }),
    error => error instanceof TemporalApiError && error.code === TEMPORAL_ERROR_CODES.INVALID_OPTIONS);
  });
}
