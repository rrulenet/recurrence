import test from 'node:test';
import assert from 'node:assert/strict';
import { Temporal } from 'temporal-polyfill';

import { Recurrence } from '../dist/index.mjs';

test('Recurrence.toString serializes a simple composed recurrence', () => {
  const recurrence = new Recurrence({
    start: Temporal.ZonedDateTime.from('1997-09-02T09:00:00-04:00[America/New_York]'),
    include: [
      {
        rule: {
          freq: 'DAILY',
          count: 5,
        },
      },
    ],
  });

  assert.equal(
    recurrence.toString(),
    'DTSTART;TZID=America/New_York:19970902T090000\nRRULE:FREQ=DAILY;COUNT=5',
  );
});

test('Recurrence.toText describes composed weekday/weekend schedules', () => {
  const recurrence = new Recurrence({
    start: Temporal.ZonedDateTime.from('2026-01-01T09:00:00+01:00[Europe/Paris]'),
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
  });

  const text = recurrence.toText();
  assert.match(text, /every week on weekday at 9 AM/i);
  assert.match(text, /every week on Saturday and Sunday at 10 AM/i);
});
