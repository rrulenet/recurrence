import test from 'node:test';
import assert from 'node:assert/strict';
import { Temporal } from 'temporal-polyfill';

import { Recurrence, TEMPORAL_ERROR_CODES, TemporalApiError } from '../dist/index.mjs';

test('Recurrence.parse: missing rruleString throws a typed public error', () => {
  assert.throws(
    () => Recurrence.parse({ rruleString: '   ' }),
    (error) =>
      error instanceof TemporalApiError
      && error.code === TEMPORAL_ERROR_CODES.INVALID_RRULE_STRING
      && error.message === 'Missing or empty rruleString',
  );
});

test('Recurrence.rule: invalid options shape throws a typed public error', () => {
  assert.throws(
    () => Recurrence.rule('FREQ=DAILY'),
    (error) =>
      error instanceof TemporalApiError
      && error.code === TEMPORAL_ERROR_CODES.INVALID_OPTIONS
      && error.message === 'Recurrence.rule() expects a plain options object',
  );
});

test('new Recurrence: invalid include shape throws a typed public error', () => {
  assert.throws(
    () => new Recurrence({ include: { rule: { freq: 'DAILY' } } }),
    (error) =>
      error instanceof TemporalApiError
      && error.code === TEMPORAL_ERROR_CODES.INVALID_OPTIONS
      && error.message === 'new Recurrence() expects include to be an array',
  );
});

test('new Recurrence: conflicting timezone intent across entries throws a typed public error', () => {
  assert.throws(
    () => new Recurrence({
      include: [
        {
          rule: {
            freq: 'DAILY',
            count: 2,
            start: Temporal.ZonedDateTime.from('2025-01-01T09:00:00+01:00[Europe/Paris]'),
          },
        },
        {
          dates: [Temporal.ZonedDateTime.from('2025-01-02T09:00:00Z[UTC]')],
        },
      ],
    }),
    /Multiple conflicting ZonedDateTime values in one call/,
  );
});
