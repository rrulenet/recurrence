<p align="center">
  <a href="https://rrule.net">
    <img src="./assets/avatar.svg" alt="rrule.net" width="96" height="96">
  </a>
</p>

<h1 align="center">@rrulenet/recurrence</h1>

<p align="center">
  Temporal-first recurrence API for rules, composed schedules, and RFC 5545 parsing.
</p>

<p align="center">
  <a href="https://rrule.net">rrule.net</a> •
  <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Temporal">Temporal API</a> •
  <strong>@rrulenet ecosystem</strong>
</p>

<p align="center">
  <code>@rrulenet/rrule</code> ·
  <code>@rrulenet/recurrence</code> ·
  <code>@rrulenet/core</code> ·
  <code>@rrulenet/cli</code>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@rrulenet/recurrence"><img src="https://img.shields.io/npm/v/%40rrulenet%2Frecurrence" alt="npm version"></a>
  <a href="https://rrulenet.github.io/recurrence/coverage.json"><img src="https://img.shields.io/endpoint?url=https://rrulenet.github.io/recurrence/coverage.json" alt="Coverage"></a>
  <img src="https://img.shields.io/badge/license-MIT-2563EB" alt="MIT License">
</p>

<p align="center">
  <sub><strong>@rrulenet/rrule</strong>: classic API · <strong>@rrulenet/recurrence</strong>: Temporal-first API · <strong>@rrulenet/core</strong>: engine · <strong>@rrulenet/cli</strong>: workflows</sub>
</p>

`@rrulenet/recurrence` is the Temporal-first package in the `@rrulenet` ecosystem. It is designed for applications that want one recurrence type, direct support for `Temporal.Instant` and `Temporal.ZonedDateTime`, first-class set algebra, and RFC 5545 parsing and serialization where possible.

Use `@rrulenet/recurrence` when your application boundary is already Temporal-oriented. Use `@rrulenet/rrule` when you want the classic `rrule.js`-style API.

## Table of Contents

- [Install](#install)
- [Getting Started](#getting-started)
- [Why Recurrence](#why-recurrence)
- [API](#api)
  - [Recurrence](#recurrence)
  - [Recurrence.parse(options) and parse(options)](#recurrenceparseoptions-and-parseoptions)
  - [Recurrence.rule(options) and rule(options)](#recurrenceruleoptions-and-ruleoptions)
  - [Recurrence.dates(values, options?)](#recurrencedatesvalues-options)
  - [Query Methods](#query-methods)
  - [Algebra Methods](#algebra-methods)
  - [Presentation and Serialization](#presentation-and-serialization)
- [Constructor Input Shape](#constructor-input-shape)
- [Examples](#examples)
- [Error Handling](#error-handling)
- [Development](#development)

## Install

```bash
npm install @rrulenet/recurrence
```

If your runtime does not yet provide the [Temporal API](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Temporal), install a polyfill in your application:

```bash
npm install temporal-polyfill
```

```bash
npm install @js-temporal/polyfill
```

Polyfill projects:
- [`temporal-polyfill`](https://github.com/fullcalendar/temporal-polyfill)
- [`@js-temporal/polyfill`](https://github.com/js-temporal/temporal-polyfill)

## Getting Started

```js
import { Temporal } from 'temporal-polyfill';
import { Recurrence } from '@rrulenet/recurrence';

const recurrence = Recurrence.rule({
  freq: 'DAILY',
  count: 3,
  byHour: [9],
  start: Temporal.ZonedDateTime.from('2025-01-01T09:00:00+01:00[Europe/Paris]'),
});

console.log(recurrence.all().map((value) => value.toString()));
// [
//   '2025-01-01T09:00:00+01:00[Europe/Paris]',
//   '2025-01-02T09:00:00+01:00[Europe/Paris]',
//   '2025-01-03T09:00:00+01:00[Europe/Paris]'
// ]
```

## Why Recurrence

`@rrulenet/recurrence` revolves around a single public type: `Recurrence`.

That matters because many real schedules are not just one rule. For example:

```text
Every weekday at 9:00 and weekends at 10:00
```

This package models that directly as one recurrence expression instead of forcing a split between "rule" and "rule set". That makes the API easier to compose, easier to test, and better suited to programmatic generation by applications, CLIs, or agents.

## API

```js
import {
  Recurrence,
  parse,
  rule,
  TEMPORAL_ERROR_CODES,
  TemporalApiError,
} from '@rrulenet/recurrence';
```

Main exports:
- `Recurrence`
- `parse(options)`
- `rule(options)`
- `TEMPORAL_ERROR_CODES`
- `TemporalApiError`

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

All query methods return `Temporal.ZonedDateTime` values.

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

#### `recurrence.count(limit?)`

Count occurrences. On open-ended recurrences, pass a limit to keep the query bounded.

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

#### `Recurrence.fromJSON(json)`

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

## Development

```bash
npm install
npm test
```
