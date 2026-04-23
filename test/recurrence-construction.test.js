import test from 'node:test';
import assert from 'node:assert/strict';
import { Temporal } from 'temporal-polyfill';

import { Recurrence, parse } from '../dist/index.mjs';

test('Recurrence.rule: accepts Instant with explicit tzid', () => {
  const recurrence = Recurrence.rule({
    freq: 'DAILY',
    count: 3,
    byHour: [9],
    start: Temporal.Instant.from('2025-01-01T08:00:00Z'),
    tzid: 'Europe/Paris',
  });

  assert.equal(recurrence instanceof Recurrence, true);
  assert.deepEqual(recurrence.all().map((value) => value.toString()), [
    '2025-01-01T09:00:00+01:00[Europe/Paris]',
    '2025-01-02T09:00:00+01:00[Europe/Paris]',
    '2025-01-03T09:00:00+01:00[Europe/Paris]',
  ]);
});

test('Recurrence.parse: infers tzid from ZonedDateTime', () => {
  const recurrence = Recurrence.parse({
    rruleString: 'RRULE:FREQ=DAILY;COUNT=2;BYHOUR=9',
    start: Temporal.ZonedDateTime.from('2025-01-01T09:00:00+01:00[Europe/Paris]'),
  });

  assert.equal(recurrence.tzid, 'Europe/Paris');
  assert.deepEqual(recurrence.all().map((value) => value.toString()), [
    '2025-01-01T09:00:00+01:00[Europe/Paris]',
    '2025-01-02T09:00:00+01:00[Europe/Paris]',
  ]);
});

test('Recurrence.parse: inline DTSTART remains authoritative over external start', () => {
  const recurrence = Recurrence.parse({
    rruleString: 'DTSTART;TZID=UTC:20250101T100000\nRRULE:FREQ=DAILY;COUNT=2',
    start: Temporal.ZonedDateTime.from('2025-01-01T09:00:00+01:00[Europe/Paris]'),
  });

  assert.equal(recurrence.tzid, 'UTC');
  assert.deepEqual(recurrence.all().map((value) => value.toString()), [
    '2025-01-01T10:00:00+00:00[UTC]',
    '2025-01-02T10:00:00+00:00[UTC]',
  ]);
});

test('new Recurrence: composes include and exclude entries', () => {
  const recurrence = new Recurrence({
    start: Temporal.ZonedDateTime.from('2025-01-01T09:00:00Z[UTC]'),
    include: [
      {
        rule: {
          freq: 'WEEKLY',
          byDay: ['MO', 'TU', 'WE', 'TH', 'FR'],
          byHour: [9],
        },
      },
      {
        rule: {
          freq: 'WEEKLY',
          byDay: ['SA', 'SU'],
          byHour: [10],
        },
      },
    ],
    exclude: [
      {
        dates: [Temporal.Instant.from('2025-01-04T10:00:00Z')],
      },
    ],
  });

  assert.deepEqual(
    recurrence.between(
      Temporal.Instant.from('2025-01-01T00:00:00Z'),
      Temporal.Instant.from('2025-01-06T23:59:59Z'),
      true,
    ).map((value) => value.toString()),
    [
      '2025-01-01T09:00:00+00:00[UTC]',
      '2025-01-02T09:00:00+00:00[UTC]',
      '2025-01-03T09:00:00+00:00[UTC]',
      '2025-01-05T10:00:00+00:00[UTC]',
      '2025-01-06T09:00:00+00:00[UTC]',
    ],
  );
});

test('parse remains as convenience sugar around Recurrence.parse', () => {
  const recurrence = parse({
    rruleString: 'RRULE:FREQ=DAILY;COUNT=2',
    start: Temporal.ZonedDateTime.from('2025-01-01T09:00:00Z[UTC]'),
  });

  assert.equal(recurrence instanceof Recurrence, true);
  assert.deepEqual(recurrence.all().map((value) => value.toString()), [
    '2025-01-01T09:00:00+00:00[UTC]',
    '2025-01-02T09:00:00+00:00[UTC]',
  ]);
});
