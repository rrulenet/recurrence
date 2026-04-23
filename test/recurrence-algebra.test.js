import test from 'node:test';
import assert from 'node:assert/strict';
import { Temporal } from 'temporal-polyfill';

import { Recurrence, TEMPORAL_ERROR_CODES, TemporalApiError } from '../dist/index.mjs';

test('Recurrence.includingDates and excludingDates preserve immutability', () => {
  const base = Recurrence.rule({
    freq: 'DAILY',
    count: 2,
    start: Temporal.ZonedDateTime.from('2025-01-01T09:00:00Z[UTC]'),
  });

  const extended = base
    .includingDates([Temporal.Instant.from('2025-01-05T09:00:00Z')])
    .excludingDates([Temporal.Instant.from('2025-01-02T09:00:00Z')]);

  assert.deepEqual(base.all().map((value) => value.toString()), [
    '2025-01-01T09:00:00+00:00[UTC]',
    '2025-01-02T09:00:00+00:00[UTC]',
  ]);
  assert.deepEqual(extended.all().map((value) => value.toString()), [
    '2025-01-01T09:00:00+00:00[UTC]',
    '2025-01-05T09:00:00+00:00[UTC]',
  ]);
});

test('Recurrence.union composes multiple recurrences as a first-class operation', () => {
  const weekdays = Recurrence.rule({
    freq: 'WEEKLY',
    start: Temporal.ZonedDateTime.from('2026-01-01T09:00:00+01:00[Europe/Paris]'),
    byDay: ['MO', 'TU', 'WE', 'TH', 'FR'],
    byHour: [9],
  });
  const weekends = Recurrence.rule({
    freq: 'WEEKLY',
    start: Temporal.ZonedDateTime.from('2026-01-01T09:00:00+01:00[Europe/Paris]'),
    byDay: ['SA', 'SU'],
    byHour: [10],
  });

  const recurrence = Recurrence.union(weekdays, weekends);
  assert.deepEqual(
    recurrence.between(
      Temporal.Instant.from('2026-01-01T00:00:00Z'),
      Temporal.Instant.from('2026-01-06T23:59:59Z'),
      true,
    ).map((value) => value.toString()),
    [
      '2026-01-01T09:00:00+01:00[Europe/Paris]',
      '2026-01-02T09:00:00+01:00[Europe/Paris]',
      '2026-01-03T10:00:00+01:00[Europe/Paris]',
      '2026-01-04T10:00:00+01:00[Europe/Paris]',
      '2026-01-05T09:00:00+01:00[Europe/Paris]',
      '2026-01-06T09:00:00+01:00[Europe/Paris]',
    ],
  );
});

test('Recurrence.intersection keeps only shared occurrences', () => {
  const daily = Recurrence.rule({
    freq: 'DAILY',
    count: 7,
    start: Temporal.ZonedDateTime.from('2025-01-01T09:00:00Z[UTC]'),
  });
  const weekdayMorning = Recurrence.rule({
    freq: 'WEEKLY',
    start: Temporal.ZonedDateTime.from('2025-01-01T09:00:00Z[UTC]'),
    byDay: ['MO', 'TU', 'WE', 'TH', 'FR'],
    byHour: [9],
  });

  const recurrence = Recurrence.intersection(daily, weekdayMorning);
  assert.deepEqual(recurrence.all().map((value) => value.toString()), [
    '2025-01-01T09:00:00+00:00[UTC]',
    '2025-01-02T09:00:00+00:00[UTC]',
    '2025-01-03T09:00:00+00:00[UTC]',
    '2025-01-06T09:00:00+00:00[UTC]',
    '2025-01-07T09:00:00+00:00[UTC]',
  ]);
  assert.equal(recurrence.isFullyConvertibleToText(), false);
});

test('Recurrence.difference excludes one recurrence from another', () => {
  const daily = Recurrence.rule({
    freq: 'DAILY',
    count: 5,
    start: Temporal.ZonedDateTime.from('2025-01-01T09:00:00Z[UTC]'),
  });
  const weekend = Recurrence.rule({
    freq: 'WEEKLY',
    start: Temporal.ZonedDateTime.from('2025-01-01T09:00:00Z[UTC]'),
    byDay: ['SA', 'SU'],
    byHour: [9],
  });

  const weekdaysOnly = daily.difference(weekend);
  assert.deepEqual(weekdaysOnly.all().map((value) => value.toString()), [
    '2025-01-01T09:00:00+00:00[UTC]',
    '2025-01-02T09:00:00+00:00[UTC]',
    '2025-01-03T09:00:00+00:00[UTC]',
  ]);
});

test('Recurrence.toString rejects non-flat algebraic expressions', () => {
  const weekdays = Recurrence.rule({
    freq: 'WEEKLY',
    start: Temporal.ZonedDateTime.from('2026-01-01T09:00:00+01:00[Europe/Paris]'),
    byDay: ['MO', 'TU', 'WE', 'TH', 'FR'],
    byHour: [9],
  });
  const weekends = Recurrence.rule({
    freq: 'WEEKLY',
    start: Temporal.ZonedDateTime.from('2026-01-01T09:00:00+01:00[Europe/Paris]'),
    byDay: ['SA', 'SU'],
    byHour: [10],
  });

  assert.throws(
    () => Recurrence.union(weekdays, weekends).toString(),
    (error) =>
      error instanceof TemporalApiError
      && error.code === TEMPORAL_ERROR_CODES.UNSERIALIZABLE_EXPRESSION
      && error.message === 'This Recurrence expression cannot be serialized as a flat RFC string',
  );
  assert.throws(
    () => Recurrence.intersection(weekdays, weekends).toString(),
    (error) =>
      error instanceof TemporalApiError
      && error.code === TEMPORAL_ERROR_CODES.UNSERIALIZABLE_EXPRESSION
      && error.message === 'This Recurrence expression cannot be serialized as a flat RFC string',
  );
});
