import test from 'node:test';
import assert from 'node:assert/strict';
import { Temporal } from 'temporal-polyfill';

import { Recurrence } from '../dist/index.mjs';

test('Recurrence query helpers expose first, take, count, hasAnyBetween, hasAny, isEmpty, and occursAt', () => {
  const recurrence = Recurrence.rule({
    freq: 'DAILY',
    count: 4,
    start: Temporal.ZonedDateTime.from('2025-01-01T09:00:00Z[UTC]'),
  });

  assert.equal(recurrence.first()?.toString(), '2025-01-01T09:00:00+00:00[UTC]');
  assert.deepEqual(recurrence.take(2).map((value) => value.toString()), [
    '2025-01-01T09:00:00+00:00[UTC]',
    '2025-01-02T09:00:00+00:00[UTC]',
  ]);
  assert.equal(recurrence.count(), 4);
  assert.equal(recurrence.count(2), 2);
  assert.equal(
    recurrence.hasAnyBetween(
      Temporal.Instant.from('2025-01-02T00:00:00Z'),
      Temporal.Instant.from('2025-01-02T23:59:59Z'),
      true,
    ),
    true,
  );
  assert.equal(recurrence.hasAny(), true);
  assert.equal(recurrence.isEmpty(), false);
  assert.equal(recurrence.occursAt(Temporal.Instant.from('2025-01-03T09:00:00Z')), true);
  assert.equal(recurrence.occursAt(Temporal.Instant.from('2025-01-03T10:00:00Z')), false);
});

test('Recurrence.takeAfter returns occurrences after a boundary', () => {
  const recurrence = Recurrence.rule({
    freq: 'DAILY',
    count: 4,
    start: Temporal.ZonedDateTime.from('2025-01-01T09:00:00Z[UTC]'),
  });

  assert.deepEqual(
    recurrence
      .takeAfter(Temporal.Instant.from('2025-01-02T09:00:00Z'), 2)
      .map((value) => value.toString()),
    [
      '2025-01-03T09:00:00+00:00[UTC]',
      '2025-01-04T09:00:00+00:00[UTC]',
    ],
  );
  assert.deepEqual(
    recurrence
      .takeAfter(Temporal.Instant.from('2025-01-02T09:00:00Z'), 2, true)
      .map((value) => value.toString()),
    [
      '2025-01-02T09:00:00+00:00[UTC]',
      '2025-01-03T09:00:00+00:00[UTC]',
    ],
  );
  assert.deepEqual(recurrence.takeAfter(Temporal.Instant.from('2025-01-01T00:00:00Z'), 0), []);
  assert.throws(() => recurrence.takeAfter(Temporal.Instant.from('2025-01-01T00:00:00Z'), -1), /takeAfter\(\) expects a non-negative integer/);
});

test('Recurrence.takeAfter handles monthly set-position exclusions', () => {
  const recurrence = new Recurrence({
    start: Temporal.ZonedDateTime.from('2026-01-01T18:00:00+01:00[Europe/Paris]'),
    include: [
      {
        rule: {
          freq: 'MONTHLY',
          byDay: ['TU'],
          bySetPos: [2],
          byHour: [18],
          byMinute: [0],
          bySecond: [0],
        },
      },
    ],
    exclude: [
      {
        rule: {
          freq: 'MONTHLY',
          byMonth: [8],
          byDay: ['TU'],
          bySetPos: [2],
          byHour: [18],
          byMinute: [0],
          bySecond: [0],
        },
      },
    ],
  });

  assert.deepEqual(
    recurrence
      .takeAfter(Temporal.Instant.from('2026-01-01T00:00:00Z'), 10)
      .map((value) => value.toPlainDate().toString()),
    [
      '2026-01-13',
      '2026-02-10',
      '2026-03-10',
      '2026-04-14',
      '2026-05-12',
      '2026-06-09',
      '2026-07-14',
      '2026-09-08',
      '2026-10-13',
      '2026-11-10',
    ],
  );
});

test('Recurrence clone and equals work on flat and algebraic expressions', () => {
  const weekdays = Recurrence.rule({
    freq: 'WEEKLY',
    byDay: ['MO', 'TU', 'WE', 'TH', 'FR'],
    byHour: [9],
    start: Temporal.ZonedDateTime.from('2026-01-01T09:00:00+01:00[Europe/Paris]'),
  });
  const weekends = Recurrence.rule({
    freq: 'WEEKLY',
    byDay: ['SA', 'SU'],
    byHour: [10],
    start: Temporal.ZonedDateTime.from('2026-01-01T09:00:00+01:00[Europe/Paris]'),
  });

  const algebraic = Recurrence.union(weekdays, weekends);
  const clone = algebraic.clone();

  assert.equal(clone === algebraic, false);
  assert.equal(clone.equals(algebraic), true);
  assert.equal(algebraic.equals(clone), true);
  assert.equal(weekdays.equals(weekends), false);
});

test('Recurrence.toJSON returns a stable public shape for flat recurrences', () => {
  const recurrence = new Recurrence({
    start: Temporal.ZonedDateTime.from('1997-09-02T09:00:00-04:00[America/New_York]'),
    include: [
      {
        rule: {
          freq: 'DAILY',
          count: 5,
          byDay: ['MO', { weekday: 'FR', ordinal: -1 }],
        },
      },
    ],
    exclude: [
      {
        dates: [Temporal.Instant.from('1997-09-03T13:00:00Z')],
      },
    ],
  });

  assert.deepEqual(recurrence.toJSON(), {
    kind: 'input',
    start: '1997-09-02T09:00:00-04:00[America/New_York]',
    tzid: 'America/New_York',
    include: [
      {
        rule: {
          freq: 'DAILY',
          start: '1997-09-02T13:00:00Z',
          tzid: 'America/New_York',
          interval: 1,
          count: 5,
          until: undefined,
          wkst: undefined,
          bySetPos: undefined,
          byMonth: undefined,
          byMonthDay: undefined,
          byYearDay: undefined,
          byWeekNo: undefined,
          byDay: ['MO', { weekday: 'FR', ordinal: -1 }],
          byHour: undefined,
          byMinute: undefined,
          bySecond: undefined,
          byEaster: undefined,
          rscale: undefined,
          skip: undefined,
        },
      },
    ],
    exclude: [
      {
        dates: ['1997-09-03T09:00:00-04:00[America/New_York]'],
      },
    ],
  });
});

test('Recurrence.toJSON returns a stable structural shape for algebraic recurrences', () => {
  const weekdays = Recurrence.rule({
    freq: 'WEEKLY',
    byDay: ['MO', 'WE'],
    byHour: [9],
    start: Temporal.ZonedDateTime.from('2026-01-01T09:00:00+01:00[Europe/Paris]'),
  });
  const weekends = Recurrence.rule({
    freq: 'WEEKLY',
    byDay: ['SA', 'SU'],
    byHour: [10],
    start: Temporal.ZonedDateTime.from('2026-01-01T09:00:00+01:00[Europe/Paris]'),
  });

  const recurrence = Recurrence.difference(
    Recurrence.union(weekdays, weekends),
    Recurrence.dates([Temporal.Instant.from('2026-01-03T09:00:00Z')]),
  );

  assert.deepEqual(recurrence.toJSON(), {
    kind: 'difference',
    include: {
      kind: 'union',
      expressions: [
        weekdays.toJSON(),
        weekends.toJSON(),
      ],
    },
    exclude: {
      kind: 'input',
      start: null,
      tzid: null,
      include: [{ dates: ['2026-01-03T09:00:00+00:00[UTC]'] }],
      exclude: [],
    },
  });
});

test('Recurrence.fromJSON rebuilds a flat recurrence', () => {
  const original = new Recurrence({
    start: Temporal.ZonedDateTime.from('1997-09-02T09:00:00-04:00[America/New_York]'),
    include: [
      {
        rule: {
          freq: 'DAILY',
          count: 3,
        },
      },
    ],
    exclude: [
      {
        dates: [Temporal.Instant.from('1997-09-03T13:00:00Z')],
      },
    ],
  });

  const rebuilt = Recurrence.fromJSON(original.toJSON());
  assert.equal(rebuilt.equals(original), true);
  assert.deepEqual(rebuilt.all().map((value) => value.toString()), [
    '1997-09-02T09:00:00-04:00[America/New_York]',
    '1997-09-04T09:00:00-04:00[America/New_York]',
  ]);
});

test('Recurrence.isJSON and validateJSON expose non-throwing JSON validation', () => {
  const recurrence = Recurrence.rule({
    freq: 'DAILY',
    count: 2,
    start: Temporal.ZonedDateTime.from('2025-01-01T09:00:00Z[UTC]'),
  });
  const json = recurrence.toJSON();

  assert.equal(Recurrence.isJSON(json), true);
  assert.deepEqual(Recurrence.validateJSON(json), { ok: true });
  assert.equal(Recurrence.isJSON({ kind: 'input', include: [] }), false);

  const result = Recurrence.validateJSON({ kind: 'input', include: [] });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.error.message, /Cannot read properties|expects/);
  }
});

test('Recurrence.fromJSON rebuilds algebraic recurrences recursively', () => {
  const weekdays = Recurrence.rule({
    freq: 'WEEKLY',
    byDay: ['MO', 'WE'],
    byHour: [9],
    start: Temporal.ZonedDateTime.from('2026-01-01T09:00:00+01:00[Europe/Paris]'),
  });
  const weekends = Recurrence.rule({
    freq: 'WEEKLY',
    byDay: ['SA', 'SU'],
    byHour: [10],
    start: Temporal.ZonedDateTime.from('2026-01-01T09:00:00+01:00[Europe/Paris]'),
  });

  const original = Recurrence.difference(
    Recurrence.union(weekdays, weekends),
    Recurrence.dates([Temporal.Instant.from('2026-01-03T09:00:00Z')]),
  );

  const rebuilt = Recurrence.fromJSON(original.toJSON());
  assert.equal(rebuilt.equals(original), true);
  assert.deepEqual(
    rebuilt.between(
      Temporal.Instant.from('2026-01-01T00:00:00Z'),
      Temporal.Instant.from('2026-01-07T23:59:59Z'),
      true,
    ).map((value) => value.toString()),
    original.between(
      Temporal.Instant.from('2026-01-01T00:00:00Z'),
      Temporal.Instant.from('2026-01-07T23:59:59Z'),
      true,
    ).map((value) => value.toString()),
  );
});

test('Recurrence.normalize flattens nested unions and intersections', () => {
  const a = Recurrence.rule({
    freq: 'DAILY',
    count: 2,
    start: Temporal.ZonedDateTime.from('2025-01-01T09:00:00Z[UTC]'),
  });
  const b = Recurrence.dates([Temporal.Instant.from('2025-01-03T09:00:00Z')]);
  const c = Recurrence.dates([Temporal.Instant.from('2025-01-04T09:00:00Z')]);

  const nestedUnion = Recurrence.union(Recurrence.union(a, b), c).normalize();
  const nestedIntersection = Recurrence.intersection(Recurrence.intersection(a, b), c).flatten();

  assert.deepEqual(nestedUnion.toJSON(), {
    kind: 'union',
    expressions: [a.toJSON(), b.toJSON(), c.toJSON()],
  });
  assert.deepEqual(nestedIntersection.toJSON(), {
    kind: 'intersection',
    expressions: [a.toJSON(), b.toJSON(), c.toJSON()],
  });
});
