import test from 'node:test';
import assert from 'node:assert/strict';
import { Temporal } from 'temporal-polyfill';

import { Recurrence, TEMPORAL_ERROR_CODES, TemporalApiError, rule } from '../dist/index.mjs';
import { formatCompactLocal, formatCompactUtc, renderDateList, renderDtstart } from '../dist/serialize.mjs';

test('top-level rule sugar delegates to Recurrence.rule', () => {
  const recurrence = rule({
    freq: 'DAILY',
    count: 2,
    start: Temporal.ZonedDateTime.from('2025-01-01T09:00:00Z[UTC]'),
  });

  assert.equal(recurrence instanceof Recurrence, true);
  assert.deepEqual(recurrence.all().map((value) => value.toString()), [
    '2025-01-01T09:00:00+00:00[UTC]',
    '2025-01-02T09:00:00+00:00[UTC]',
  ]);
});

test('serialize helpers format UTC and local recurrence values explicitly', () => {
  const utc = Temporal.ZonedDateTime.from('2025-01-01T09:00:00Z[UTC]');
  const paris = Temporal.ZonedDateTime.from('2025-01-01T09:00:00+01:00[Europe/Paris]');

  assert.equal(formatCompactUtc(utc), '20250101T090000Z');
  assert.equal(formatCompactLocal(paris), '20250101T090000');
  assert.equal(renderDtstart(utc), 'DTSTART:20250101T090000Z');
  assert.equal(renderDtstart(paris), 'DTSTART;TZID=Europe/Paris:20250101T090000');
  assert.equal(renderDateList('RDATE', [], null), '');
  assert.equal(renderDateList('RDATE', [utc], 'UTC'), 'RDATE:20250101T090000Z');
  assert.equal(
    renderDateList('EXDATE', [utc], 'Europe/Paris'),
    'EXDATE;TZID=Europe/Paris:20250101T100000',
  );
});

test('Recurrence.parse supports EXRULE and DTSTART-only inputs', () => {
  const withExrule = Recurrence.parse({
    rruleString: [
      'DTSTART;TZID=UTC:20250101T090000',
      'RRULE:FREQ=DAILY;COUNT=5',
      'EXRULE:FREQ=WEEKLY;BYDAY=FR;COUNT=1',
    ].join('\n'),
  });

  assert.deepEqual(withExrule.all().map((value) => value.toString()), [
    '2025-01-01T09:00:00+00:00[UTC]',
    '2025-01-02T09:00:00+00:00[UTC]',
    '2025-01-04T09:00:00+00:00[UTC]',
    '2025-01-05T09:00:00+00:00[UTC]',
  ]);

  const dtstartOnly = Recurrence.parse({
    rruleString: 'DTSTART;TZID=UTC:20250101T090000',
  });

  assert.deepEqual(dtstartOnly.all().map((value) => value.toString()), [
    '2025-01-01T09:00:00+00:00[UTC]',
  ]);
});

test('Recurrence public errors cover empty algebra, invalid counters, and unsupported JSON input', () => {
  assert.throws(
    () => Recurrence.union(),
    (error) => error instanceof TemporalApiError
      && error.code === TEMPORAL_ERROR_CODES.INVALID_OPTIONS
      && error.message === 'Recurrence.union() expects at least one recurrence',
  );

  assert.throws(
    () => Recurrence.intersection(),
    (error) => error instanceof TemporalApiError
      && error.code === TEMPORAL_ERROR_CODES.INVALID_OPTIONS
      && error.message === 'Recurrence.intersection() expects at least one recurrence',
  );

  const recurrence = Recurrence.rule({
    freq: 'DAILY',
    count: 2,
    start: Temporal.ZonedDateTime.from('2025-01-01T09:00:00Z[UTC]'),
  });

  assert.throws(
    () => recurrence.take(-1),
    (error) => error instanceof TemporalApiError
      && error.code === TEMPORAL_ERROR_CODES.INVALID_OPTIONS
      && error.message === 'take() expects a non-negative integer',
  );

  assert.throws(
    () => recurrence.count(-1),
    (error) => error instanceof TemporalApiError
      && error.code === TEMPORAL_ERROR_CODES.INVALID_OPTIONS
      && error.message === 'count() expects a non-negative integer',
  );

  assert.throws(
    () => Recurrence.fromJSON(null),
    (error) => error instanceof TemporalApiError
      && error.code === TEMPORAL_ERROR_CODES.INVALID_OPTIONS
      && error.message === 'Recurrence.fromJSON() expects a valid recurrence JSON object',
  );
});

test('Recurrence covers algebraic instance helpers and validation edge cases', () => {
  const base = Recurrence.rule({
    freq: 'DAILY',
    count: 3,
    start: Temporal.ZonedDateTime.from('2025-01-01T09:00:00Z[UTC]'),
  });
  const extra = Recurrence.dates([Temporal.Instant.from('2025-01-05T09:00:00Z')]);
  const algebraic = base.union(extra);

  assert.equal(algebraic.start, null);
  assert.equal(algebraic.tzid, null);
  assert.equal(algebraic.intersection(base).equals(Recurrence.intersection(algebraic, base)), true);
  assert.equal(algebraic.difference(extra).occursAt(Temporal.Instant.from('2025-01-05T09:00:00Z')), false);

  assert.throws(
    () => algebraic.toInput(),
    (error) => error instanceof TemporalApiError
      && error.code === TEMPORAL_ERROR_CODES.UNSERIALIZABLE_EXPRESSION
      && error.message === 'This Recurrence expression cannot be represented as a flat input object',
  );

  assert.throws(
    () => Recurrence.rule({
      freq: 'WEEKLY',
      byDay: [{ weekday: 9 }],
      start: Temporal.ZonedDateTime.from('2025-01-01T09:00:00Z[UTC]'),
    }),
    (error) => error instanceof TemporalApiError
      && error.code === TEMPORAL_ERROR_CODES.INVALID_OPTIONS
      && error.message === 'Invalid byDay value',
  );

  assert.throws(
    () => Recurrence.rule({
      freq: 'WEEKLY',
      wkst: 'XX',
      start: Temporal.ZonedDateTime.from('2025-01-01T09:00:00Z[UTC]'),
    }),
    (error) => error instanceof TemporalApiError
      && error.code === TEMPORAL_ERROR_CODES.INVALID_OPTIONS
      && error.message === 'Invalid wkst value: XX',
  );

  assert.throws(
    () => new Recurrence({
      tzid: 'Not/AZone',
      include: [{ dates: [Temporal.Instant.from('2025-01-01T09:00:00Z')] }],
    }),
    (error) => error instanceof TemporalApiError
      && error.code === TEMPORAL_ERROR_CODES.INVALID_TZID
      && error.message === 'Invalid tzid',
  );

  assert.throws(
    () => new Recurrence({
      include: [{ dates: [{ epochMilliseconds: Number.NaN, toString: () => 'bad', toZonedDateTimeISO: () => null }] }],
    }),
    (error) => error instanceof TemporalApiError
      && error.code === TEMPORAL_ERROR_CODES.UNSUPPORTED_INPUT
      && error.message === 'Unsupported Temporal input kind',
  );
});
