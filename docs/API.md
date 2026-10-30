# Recurrence API reference

[Package overview](../README.md) · [Release history](https://github.com/rrulenet/recurrence/releases)

Examples that import `Temporal` use `temporal-polyfill`. If your application
imports that package directly, add it as a direct dependency. Native Temporal
values can also be used when the runtime provides them.

## Table of contents

- [API](#api)
  - [`Recurrence`](#recurrence)
  - [`Recurrence.parse(options)` and `parse(options)`](#recurrenceparseoptions-and-parseoptions)
  - [`Recurrence.rule(options)` and `rule(options)`](#recurrenceruleoptions-and-ruleoptions)
  - [`Recurrence.elapsed(options)` and `elapsed(options)`](#recurrenceelapsedoptions-and-elapsedoptions)
  - [Selector validation](#selector-validation)
  - [`Recurrence.dates(values, options?)`](#recurrencedatesvalues-options)
  - [Query Methods](#query-methods)
  - [Algebra Methods](#algebra-methods)
  - [Presentation and Serialization](#presentation-and-serialization)
- [Constructor Input Shape](#constructor-input-shape)
- [Examples](#examples)
  - [Weekdays at 9:00, weekends at 10:00](#weekdays-at-900-weekends-at-1000)
  - [Parse an RFC string, then add explicit exceptions](#parse-an-rfc-string-then-add-explicit-exceptions)
  - [Build a holiday calendar from explicit dates](#build-a-holiday-calendar-from-explicit-dates)
  - [Intersect two broader schedules](#intersect-two-broader-schedules)
  - [Snapshot a recurrence for inspection or transport](#snapshot-a-recurrence-for-inspection-or-transport)
- [Error Handling](#error-handling)

## API

```ts
import {
  Recurrence,
  parse,
  rule,
  elapsed,
  TEMPORAL_ERROR_CODES,
  TemporalApiError,
} from '@rrulenet/recurrence';

import type {
  RecurrenceJson,
  RecurrenceJsonEntry,
  RecurrenceJsonRuleInput,
} from '@rrulenet/recurrence';
```

Main exports:
- `Recurrence`
- `parse(options)`
- `rule(options)`
- `elapsed(options)`
- `TEMPORAL_ERROR_CODES`
- `TemporalApiError`

Type exports:
- `RecurrenceJson`
- `RecurrenceJsonEntry`
- `RecurrenceJsonRuleInput`

### `Recurrence`

`Recurrence` is the central type. It supports:
- construction from a canonical object shape
- parsing RFC strings
- creating simple rules
- creating explicit date-only recurrences
- querying occurrences
- combining, intersecting, and subtracting recurrence expressions
- text and RFC serialization

### `Recurrence.parse(options)` and `parse(options)`

Parse an RFC 5545 recurrence string into a `Recurrence`.

```js
import { Temporal } from 'temporal-polyfill';
import { Recurrence } from '@rrulenet/recurrence';

const recurrence = Recurrence.parse({
  rruleString: 'RRULE:FREQ=DAILY;COUNT=2;BYHOUR=9',
  start: Temporal.ZonedDateTime.from('2025-01-01T09:00:00+01:00[Europe/Paris]'),
});

console.log(recurrence.all().map((value) => value.toString()));
// [
//   '2025-01-01T09:00:00+01:00[Europe/Paris]',
//   '2025-01-02T09:00:00+01:00[Europe/Paris]'
// ]
// The parsed recurrence yields ZonedDateTime values in the resolved timezone.
```

Notes:
- `rruleString` is required
- `start` can be a `Date`, `Temporal.Instant`, or `Temporal.ZonedDateTime`
- if `start` is a `Temporal.ZonedDateTime`, its timezone is inferred automatically
- inline `DTSTART` information inside the string remains authoritative

The top-level `parse(options)` export is a convenience alias for `Recurrence.parse(options)`.

### `Recurrence.rule(options)` and `rule(options)`

Create a simple rule and get back a `Recurrence`.

```js
import { Temporal } from 'temporal-polyfill';
import { rule } from '@rrulenet/recurrence';

const recurrence = rule({
  freq: 'WEEKLY',
  byDay: ['MO', 'WE', 'FR'],
  byHour: [9],
  count: 5,
  start: Temporal.Instant.from('2025-01-01T08:00:00Z'),
  tzid: 'Europe/Paris',
});

console.log(recurrence.first()?.toString());
// '2025-01-01T09:00:00+01:00[Europe/Paris]'

console.log(recurrence.take(3).map((value) => value.toString()));
// [
//   '2025-01-01T09:00:00+01:00[Europe/Paris]',
//   '2025-01-03T09:00:00+01:00[Europe/Paris]',
//   '2025-01-06T09:00:00+01:00[Europe/Paris]'
// ]
```

This is sugar for creating a `Recurrence` with one included rule. Use it when your schedule is a single rule and you want the shortest entry point.

### `Recurrence.elapsed(options)` and `elapsed(options)`

Use an explicit elapsed cadence when a fixed duration must pass between
occurrences, including both autumn passages:

```js
const cadence = Recurrence.elapsed({
  start: Temporal.Instant.from('2026-10-24T23:30:00Z'),
  every: 'PT1H',
  tzid: 'Europe/Paris',
  count: 4,
});
// UTC: 23:30, 00:30, 01:30, 02:30; both local 02:30 passages are present.
```

`start` is mandatory and exact. `every` accepts positive ISO time durations in
whole hours, minutes, and seconds and normalizes to `PT<number>S`. Calendar units
(`P1D`, months, years) and fractional-second steps are rejected. Anchors and
bounds retain nanosecond precision. Optional `count` and inclusive `until` are
mutually exclusive. `tzid` controls display only; it cannot move the grid.
Elapsed entries also work in constructor `include`/`exclude` arrays and algebra.

Calendar `rule` and `parse` keep local clock progression at every frequency.
Autumn overlaps select the first passage; spring gaps use the offset before the
transition, then later periods resume the nominal time (RFC 5545, verified
erratum 4271). Resolved duplicates count once. COUNT with UNTIL is rejected,
and invalid base-calendar dates are omitted rather than clamped.

### Selector validation

Rule construction, RFC parsing, and native JSON ingestion reject invalid
`byHour`, `byMinute`, `bySecond`, `byMonth`, and `byMonthDay` selectors with a
`RangeError`. A list containing an invalid member is rejected as a whole.
`Recurrence.validateJSON()` returns `{ ok: false, error }` for these inputs;
`Recurrence.isJSON()` returns `false`.

Second 60 resolves to second 59, with collisions removed before BYSETPOS and
COUNT. JSON and RFC serialization preserve the original selector. Valid
negative month days and supported RSCALE leap-month tokens remain accepted.

Repeated clock selector members do not shift BYSETPOS positions or consume
COUNT. Native JSON and RFC serialization preserve the original lists.

BYSETPOS selects from the distinct chronological candidates of a complete
frequency interval, including all selected months for a yearly rule. RFC numeric
tokens are checked before conversion rather than accepting empty members or
JavaScript hexadecimal, exponent, or fractional syntax.

Calendar queries detect proven unreachable clock phases. A calendar search that
exhausts its candidate budget before establishing completeness throws an error
with code `RECURRENCE_SEARCH_LIMIT`, propagated from `core`. Handle that failure
separately from an empty result; it is not a validation failure reported by
`Recurrence.validateJSON()`.

### `Recurrence.dates(values, options?)`

Create a `Recurrence` from explicit dates only.

```js
import { Temporal } from 'temporal-polyfill';
import { Recurrence } from '@rrulenet/recurrence';

const recurrence = Recurrence.dates([
  Temporal.Instant.from('2025-05-01T09:00:00Z'),
  Temporal.Instant.from('2025-05-08T09:00:00Z'),
], {
  tzid: 'Europe/Paris',
});

console.log(recurrence.all().map((value) => value.toString()));
// [
//   '2025-05-01T11:00:00+02:00[Europe/Paris]',
//   '2025-05-08T11:00:00+02:00[Europe/Paris]'
// ]
```

This is useful for holidays, one-off exceptions, or explicit include/exclude lists.

### Query Methods

For an open-ended recurrence, `all()` without a callback returns a finite
preview (up to 513 values). Use `take(count)`, `takeAfter(...)`, bounded ranges,
or directional queries to request a specific part of the series.

Occurrence queries return `Temporal.ZonedDateTime` values; counts and presence
checks return numbers and booleans respectively.

#### `recurrence.all(iterator?)`

```js
const values = recurrence.all();
console.log(values.map((value) => value.toString()));
// [
//   '2025-01-01T09:00:00+01:00[Europe/Paris]',
//   '2025-01-03T09:00:00+01:00[Europe/Paris]',
//   '2025-01-06T09:00:00+01:00[Europe/Paris]',
//   ...
// ]
```

You can also provide an iterator to stop early:

The callback stops generation when it returns `false`. `first()` and `take()`
also stop after the requested occurrences; `take(1000)` can read past the
default finite preview of an unbounded `all()`.
A filtered search that exhausts its budget throws an error with code
`RECURRENCE_SEARCH_LIMIT` rather than claiming that no values remain.

```js
const firstThree = recurrence.all((value, index) => index < 3);
console.log(firstThree.map((value) => value.toString()));
// [
//   '2025-01-01T09:00:00+01:00[Europe/Paris]',
//   '2025-01-03T09:00:00+01:00[Europe/Paris]',
//   '2025-01-06T09:00:00+01:00[Europe/Paris]'
// ]
```

#### `recurrence.between(after, before, inc = false, iterator?)`

```js
const values = recurrence.between(
  Temporal.Instant.from('2025-01-01T00:00:00Z'),
  Temporal.Instant.from('2025-01-31T23:59:59Z'),
  true,
);

console.log(values.map((value) => value.toString()));
// [
//   '2025-01-01T09:00:00+01:00[Europe/Paris]',
//   '2025-01-03T09:00:00+01:00[Europe/Paris]',
//   '2025-01-06T09:00:00+01:00[Europe/Paris]',
//   ...
// ]
```

#### `recurrence.after(date, inc = false)`

```js
const next = recurrence.after(Temporal.Instant.from('2025-01-15T12:00:00Z'));
// First occurrence strictly after the boundary by default
```

#### `recurrence.before(date, inc = false)`

```js
const previous = recurrence.before(Temporal.Instant.from('2025-01-15T12:00:00Z'));
// Last occurrence strictly before the boundary by default
```

#### `recurrence.first()`

Return the first occurrence, or `null` if none exists.

```js
const first = recurrence.first();
// Shortcut for the first occurrence in the series
```

#### `recurrence.take(count)`

Return the first `count` occurrences.

```js
const preview = recurrence.take(5);

console.log(preview.map((value) => value.toString()));
// [
//   '2025-01-01T09:00:00+01:00[Europe/Paris]',
//   '2025-01-03T09:00:00+01:00[Europe/Paris]',
//   '2025-01-06T09:00:00+01:00[Europe/Paris]',
//   '2025-01-08T09:00:00+01:00[Europe/Paris]',
//   '2025-01-10T09:00:00+01:00[Europe/Paris]'
// ]
```

#### `recurrence.takeAfter(date, count, inc = false)`

Return the next `count` occurrences after a boundary.

```js
const upcoming = recurrence.takeAfter(
  Temporal.Instant.from('2025-01-05T12:00:00Z'),
  3,
);

console.log(upcoming.map((value) => value.toString()));
// [
//   '2025-01-06T09:00:00+01:00[Europe/Paris]',
//   '2025-01-08T09:00:00+01:00[Europe/Paris]',
//   '2025-01-10T09:00:00+01:00[Europe/Paris]'
// ]
```

This is useful for product APIs, queues, and dashboards that need the next N occurrences from a moving boundary without manually looping over `after()`.

#### `recurrence.count(limit?)`

Count the values returned by `all()`, or up to the supplied limit. On an
open-ended recurrence, `count()` reflects the finite preview, not the size of
the full series. Use `count(limit)` to choose an explicit bound.

```js
const exact = recurrence.count();
const bounded = recurrence.count(10);

console.log(exact);
// 5

console.log(bounded);
// 5
```

#### `recurrence.hasAny()`, `recurrence.isEmpty()`

Quick presence checks.

```js
if (recurrence.hasAny()) {
  console.log('Schedule has at least one occurrence');
}
```

#### `recurrence.hasAnyBetween(after, before, inc = false)`

Check whether at least one occurrence exists in a range.

```js
const activeThisWeek = recurrence.hasAnyBetween(
  Temporal.Instant.from('2025-01-01T00:00:00Z'),
  Temporal.Instant.from('2025-01-07T23:59:59Z'),
  true,
);
// Boolean check without materializing the full matching slice
```

#### `recurrence.occursAt(date)`

Check whether the recurrence contains an occurrence at an exact instant.

```js
const occurs = recurrence.occursAt(Temporal.Instant.from('2025-01-03T09:00:00Z'));
// Exact instant membership check
```

### Algebra Methods

#### `new Recurrence(input)`

The constructor accepts the canonical composed shape:

```js
import { Temporal } from 'temporal-polyfill';
import { Recurrence } from '@rrulenet/recurrence';

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
  exclude: [
    {
      dates: [Temporal.Instant.from('2026-01-03T09:00:00Z')],
    },
  ],
});
```

This is the most expressive entry point. Use it when you want one recurrence object that includes multiple rules, explicit dates, exclusions, or both.

#### `Recurrence.union(...recurrences)` and `recurrence.union(...recurrences)`

Combine multiple recurrence expressions.

```js
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

const combined = Recurrence.union(weekdays, weekends);

console.log(combined.toText());
// every week on weekday at 9 AM CET and every week on Saturday and Sunday at 10 AM CET
```

This is a first-class algebraic composition. It is more general than the flat constructor shape.

#### `Recurrence.intersection(...recurrences)` and `recurrence.intersection(...recurrences)`

Keep only the occurrences shared by multiple recurrence expressions.

```js
const daily = Recurrence.rule({
  freq: 'DAILY',
  count: 7,
  start: Temporal.ZonedDateTime.from('2025-01-01T09:00:00Z[UTC]'),
});

const weekdays = Recurrence.rule({
  freq: 'WEEKLY',
  byDay: ['MO', 'TU', 'WE', 'TH', 'FR'],
  byHour: [9],
  start: Temporal.ZonedDateTime.from('2025-01-01T09:00:00Z[UTC]'),
});

const weekdayDaily = Recurrence.intersection(daily, weekdays);

console.log(weekdayDaily.all().map((value) => value.toString()));
// [
//   '2025-01-01T09:00:00+00:00[UTC]',
//   '2025-01-02T09:00:00+00:00[UTC]',
//   '2025-01-03T09:00:00+00:00[UTC]',
//   '2025-01-06T09:00:00+00:00[UTC]',
//   '2025-01-07T09:00:00+00:00[UTC]'
// ]
```

This is useful when a schedule is best expressed as the overlap between broader recurrence expressions.

#### `Recurrence.difference(include, exclude)` and `recurrence.difference(exclude)`

Subtract one recurrence from another.

```js
const businessDays = Recurrence.rule({
  freq: 'DAILY',
  count: 10,
  start: Temporal.ZonedDateTime.from('2025-01-01T09:00:00Z[UTC]'),
});

const weekends = Recurrence.rule({
  freq: 'WEEKLY',
  byDay: ['SA', 'SU'],
  byHour: [9],
  start: Temporal.ZonedDateTime.from('2025-01-01T09:00:00Z[UTC]'),
});

const weekdaysOnly = businessDays.difference(weekends);

console.log(weekdaysOnly.take(3).map((value) => value.toString()));
// [
//   '2025-01-01T09:00:00+00:00[UTC]',
//   '2025-01-02T09:00:00+00:00[UTC]',
//   '2025-01-03T09:00:00+00:00[UTC]'
// ]
```

#### `recurrence.includingDates(values)` and `recurrence.excludingDates(values)`

Return a new `Recurrence` with extra dates included or excluded.

```js
const adjusted = recurrence
  .includingDates([Temporal.Instant.from('2025-01-05T09:00:00Z')])
  .excludingDates([Temporal.Instant.from('2025-01-02T09:00:00Z')]);

console.log(adjusted.all().map((value) => value.toString()));
// The extra date is added and the excluded date is removed, without mutating `recurrence`
```

These methods are immutable: they do not mutate the original recurrence.

### Presentation and Serialization

#### JSON format and legacy inputs

Native JSON emits `temporalVersion: 2` on every expression node and retains
`rule`, `elapsed`, or `dates` discriminators. Unknown versions fail with
`TEMPORAL_UNSUPPORTED_TEMPORAL_VERSION`. Unversioned rule JSON requires an
explicit migration choice:

```js
const adopted = Recurrence.fromJSON(legacyJson, { legacy: 'calendar' });
const saved = adopted.toJSON(); // Persist the reviewed versioned definition.
```

`isJSON` and `validateJSON` accept the same option. Date-only legacy inputs can
still be read; unversioned elapsed inputs cannot. Adoption selects calendar
semantics, so inspect the original definition first. To retain an
elapsed intention, construct an elapsed source using its original exact anchor.

Upgrade all readers and workers before saving version 2 JSON: older versions
may accept it while applying the previous recurrence semantics. Keep original
definitions and execution history for rollback.

Simple elapsed expressions can export a UTC SECONDLY rule. Mixed elapsed
expressions, fractional seconds, distinct rule anchors, and local second-passage
DTSTART boundaries that RFC cannot preserve throw
`TEMPORAL_UNSERIALIZABLE_EXPRESSION`. Native JSON remains the lossless format.
Explicit second-passage dates export as UTC where necessary.

#### `recurrence.toString()`

Serialize a flat recurrence to RFC-compatible lines.

```js
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

console.log(recurrence.toString());
// DTSTART;TZID=America/New_York:19970902T090000
// RRULE:FREQ=DAILY;COUNT=5
// Flat RFC-compatible representation
```

For algebraic expressions such as `Recurrence.union(...)` and `Recurrence.difference(...)`, `toString()` throws `TEMPORAL_UNSERIALIZABLE_EXPRESSION` when there is no flat RFC representation.

#### `recurrence.toText(options?)`

Describe a recurrence in natural language.

```js
console.log(recurrence.toText());
// every week on weekday at 9 AM, every week on Saturday and Sunday at 10 AM
```

#### `recurrence.isFullyConvertibleToText(options?)`

Check whether the full recurrence expression can be rendered completely as text.

```js
if (recurrence.isFullyConvertibleToText()) {
  console.log(recurrence.toText());
}
```

#### `recurrence.toInput()`

Return the flat constructor shape for flat recurrences.

```js
const input = recurrence.toInput();
```

Like `toString()`, this throws for non-flat algebraic expressions.

#### `recurrence.toJSON()`

Return a stable public JSON shape. Flat recurrences serialize as flat input-like objects; algebraic recurrences serialize as structural expressions.

```js
const json = recurrence.toJSON();

console.log(json);
// {
//   temporalVersion: 2,
//   kind: 'input',
//   start: '2025-01-01T09:00:00+01:00[Europe/Paris]',
//   tzid: 'Europe/Paris',
//   include: [
//     {
//       rule: {
//         freq: 'WEEKLY',
//         start: '2025-01-01T08:00:00Z',
//         tzid: 'Europe/Paris',
//         interval: 1,
//         count: 5,
//         byDay: ['MO', 'WE', 'FR'],
//         byHour: [9],
//       },
//     },
//   ],
//   exclude: [],
// }
```

This is the recommended representation for inspection, snapshots, transport, and structural equality checks.

#### `Recurrence.fromJSON(json, options?)`

Rebuild a `Recurrence` from a value previously produced by `toJSON()`.

```js
const recurrence = rule({
  freq: 'WEEKLY',
  byDay: ['MO', 'WE', 'FR'],
  byHour: [9],
  count: 5,
  start: Temporal.Instant.from('2025-01-01T08:00:00Z'),
  tzid: 'Europe/Paris',
});

const saved = recurrence.toJSON();
console.log(saved);
// {
//   temporalVersion: 2,
//   kind: 'input',
//   start: '2025-01-01T09:00:00+01:00[Europe/Paris]',
//   tzid: 'Europe/Paris',
//   include: [
//     {
//       rule: {
//         freq: 'WEEKLY',
//         start: '2025-01-01T08:00:00Z',
//         tzid: 'Europe/Paris',
//         interval: 1,
//         count: 5,
//         byDay: ['MO', 'WE', 'FR'],
//         byHour: [9],
//       },
//     },
//   ],
//   exclude: [],
// }

const rebuilt = Recurrence.fromJSON(saved);
console.log(rebuilt instanceof Recurrence);
// true
```

This supports both flat input-shaped recurrences and algebraic expressions such as unions, intersections, and differences.

#### `Recurrence.isJSON(value)` and `Recurrence.validateJSON(value)`

Validate a persisted or received JSON value before rebuilding a `Recurrence`.

```js
const saved = recurrence.toJSON();

console.log(Recurrence.isJSON(saved));
// true

const validation = Recurrence.validateJSON(saved);
console.log(validation);
// { ok: true }

if (Recurrence.isJSON(saved)) {
  const rebuilt = Recurrence.fromJSON(saved);
  console.log(rebuilt.equals(recurrence));
  // true
}
```

Use `isJSON()` when you want TypeScript narrowing. Use `validateJSON()` when an API boundary needs a non-throwing result that can expose the validation error.

#### `recurrence.clone()`

Create a new `Recurrence` with the same public structure.

```js
const copy = recurrence.clone();
// Independent Recurrence instance with the same public structure
```

#### `recurrence.equals(other)`

Check structural equality through the public JSON representation.

```js
if (recurrence.equals(otherRecurrence)) {
  console.log('Same recurrence shape');
}
// Structural equality based on the public JSON representation
```

#### `recurrence.normalize()` and `recurrence.flatten()`

Normalize nested unions and intersections into a simpler structural form.

```js
const normalized = Recurrence.union(
  Recurrence.union(a, b),
  c,
).normalize();
// Nested unions/intersections are flattened into a simpler structural form
```

This is useful when recurrence expressions are assembled programmatically and you want a more stable shape for inspection or comparison.

## Constructor Input Shape

```ts
type RecurrenceInput = {
  start?: Date | Temporal.Instant | Temporal.ZonedDateTime | null;
  tzid?: string | null;
  include: RecurrenceEntry[];
  exclude?: RecurrenceEntry[];
};

type RecurrenceEntry =
  | { rule: RecurrenceRuleInput }
  | { elapsed: RecurrenceElapsedInput }
  | { dates: (Date | Temporal.Instant | Temporal.ZonedDateTime)[] };
```

Rule fields supported by `RecurrenceRuleInput` include:
- `freq`
- `start`
- `tzid`
- `interval`
- `count`
- `until`
- `wkst`
- `bySetPos`
- `byMonth`
- `byMonthDay`
- `byYearDay`
- `byWeekNo`
- `byDay`
- `byHour`
- `byMinute`
- `bySecond`
- `byEaster`
- `rscale`
- `skip`

Accepted date inputs:
- `Date`
- `Temporal.Instant`
- `Temporal.ZonedDateTime`

## Examples

### Weekdays at 9:00, weekends at 10:00

```js
import { Temporal } from 'temporal-polyfill';
import { Recurrence } from '@rrulenet/recurrence';

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
```

### Parse an RFC string, then add explicit exceptions

```js
import { Temporal } from 'temporal-polyfill';
import { Recurrence } from '@rrulenet/recurrence';

const recurrence = Recurrence.parse({
  rruleString: 'RRULE:FREQ=DAILY;COUNT=5;BYHOUR=9',
  start: Temporal.ZonedDateTime.from('2025-01-01T09:00:00Z[UTC]'),
}).excludingDates([
  Temporal.Instant.from('2025-01-03T09:00:00Z'),
]);
```

### Build a holiday calendar from explicit dates

```js
import { Temporal } from 'temporal-polyfill';
import { Recurrence } from '@rrulenet/recurrence';

const holidays = Recurrence.dates([
  Temporal.ZonedDateTime.from('2025-05-01T00:00:00+02:00[Europe/Paris]'),
  Temporal.ZonedDateTime.from('2025-05-08T00:00:00+02:00[Europe/Paris]'),
]);
```

### Intersect two broader schedules

```js
import { Temporal } from 'temporal-polyfill';
import { Recurrence } from '@rrulenet/recurrence';

const everyDay = Recurrence.rule({
  freq: 'DAILY',
  count: 10,
  start: Temporal.ZonedDateTime.from('2025-01-01T09:00:00Z[UTC]'),
});

const weekdays = Recurrence.rule({
  freq: 'WEEKLY',
  byDay: ['MO', 'TU', 'WE', 'TH', 'FR'],
  byHour: [9],
  start: Temporal.ZonedDateTime.from('2025-01-01T09:00:00Z[UTC]'),
});

const weekdayOccurrences = Recurrence.intersection(everyDay, weekdays);
```

### Snapshot a recurrence for inspection or transport

```js
import { Temporal } from 'temporal-polyfill';
import { Recurrence } from '@rrulenet/recurrence';

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

const snapshot = recurrence.toJSON();
// Plain JSON value that can be stored in a DB or sent over the network

const rebuilt = Recurrence.fromJSON(snapshot);
// Full Recurrence instance rebuilt from the saved JSON

const stable = recurrence.normalize().toJSON();
// Useful when a program has built nested unions/intersections and you want a simpler saved shape

console.log(snapshot);
// {
//   temporalVersion: 2,
//   kind: 'input',
//   start: '2026-01-01T09:00:00+01:00[Europe/Paris]',
//   tzid: 'Europe/Paris',
//   include: [
//     { rule: { freq: 'WEEKLY', start: '2026-01-01T08:00:00Z', tzid: 'Europe/Paris', interval: 1, count: null, byDay: ['MO', 'TU', 'WE', 'TH', 'FR'], byHour: [9] } },
//     { rule: { freq: 'WEEKLY', start: '2026-01-01T08:00:00Z', tzid: 'Europe/Paris', interval: 1, count: null, byDay: ['SA', 'SU'], byHour: [10] } },
//   ],
//   exclude: [],
// }

console.log(rebuilt instanceof Recurrence);
// true
```

## Error Handling

Public API errors are thrown as `TemporalApiError`.

```js
import { TEMPORAL_ERROR_CODES, TemporalApiError, Recurrence } from '@rrulenet/recurrence';

try {
  Recurrence.parse({ rruleString: '   ' });
} catch (error) {
  if (error instanceof TemporalApiError) {
    console.log(error.code === TEMPORAL_ERROR_CODES.INVALID_RRULE_STRING);
  }
}
```

Available error codes:
- `TEMPORAL_INVALID_OPTIONS`
- `TEMPORAL_INVALID_RRULE_STRING`
- `TEMPORAL_INVALID_DATE`
- `TEMPORAL_INVALID_TZID`
- `TEMPORAL_UNSUPPORTED_INPUT`
- `TEMPORAL_TZID_CONTRADICTION`
- `TEMPORAL_CONFLICTING_ZONED_DATETIMES`
- `TEMPORAL_INVALID_COLLECTION_ELEMENT`
- `TEMPORAL_INVALID_ENTRY`
- `TEMPORAL_UNSERIALIZABLE_EXPRESSION`
- `TEMPORAL_UNSUPPORTED_TEMPORAL_VERSION`
