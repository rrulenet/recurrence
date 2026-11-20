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
  <a href="https://jsr.io/@rrulenet/recurrence"><img src="https://img.shields.io/jsr/v/%40rrulenet%2Frecurrence" alt="JSR version"></a>
  <a href="https://rrulenet.github.io/recurrence/coverage.json"><img src="https://img.shields.io/endpoint?url=https://rrulenet.github.io/recurrence/coverage.json" alt="Coverage"></a>
  <img src="https://img.shields.io/badge/license-MIT-2563EB" alt="MIT License">
</p>

<p align="center">
  <sub><strong>@rrulenet/rrule</strong>: classic API · <strong>@rrulenet/recurrence</strong>: Temporal-first API · <strong>@rrulenet/core</strong>: engine · <strong>@rrulenet/cli</strong>: workflows</sub>
</p>

`@rrulenet/recurrence` models rules, explicit dates and composed schedules with
one public type: `Recurrence`. It accepts `Date` and Temporal inputs, returns
Temporal occurrences, and supports RFC 5545 parsing and native JSON persistence.

Use it to embed recurrence logic in an application. For the classic
`rrule.js`-style API, see [`@rrulenet/rrule`](https://github.com/rrulenet/rrule).

## Install

```bash
npm install @rrulenet/recurrence
```

Requires Node.js 20 or later when used with Node. The library uses native
Temporal where available and the included polyfill otherwise. Inputs can use
native Temporal, `temporal-polyfill`, or `@js-temporal/polyfill` values.

## Getting started

```js
import { Recurrence } from '@rrulenet/recurrence';

const recurrence = Recurrence.rule({
  freq: 'WEEKLY',
  byDay: ['MO', 'WE', 'FR'],
  byHour: [9],
  start: new Date('2026-01-05T08:00:00Z'),
  tzid: 'Europe/Paris',
});

console.log(recurrence.take(3).map((value) => value.toString()));
// [
//   '2026-01-05T09:00:00+01:00[Europe/Paris]',
//   '2026-01-07T09:00:00+01:00[Europe/Paris]',
//   '2026-01-09T09:00:00+01:00[Europe/Paris]'
// ]
```

To parse an RFC-style string:

```js
const parsed = Recurrence.parse({
  rruleString: 'DTSTART:20260105T080000Z\nRRULE:FREQ=DAILY;COUNT=3',
});
```

## Choose the temporal intention

| Constructor | Meaning |
| --- | --- |
| `Recurrence.rule()` / `Recurrence.parse()` | Follow calendar dates and local clock values |
| `Recurrence.elapsed()` | Repeat a fixed duration from an exact anchor |
| `Recurrence.dates()` | Preserve explicit instants |

For example, an hourly elapsed cadence crosses both passages of an autumn
overlap:

```js
const cadence = Recurrence.elapsed({
  start: new Date('2026-10-24T23:30:00Z'),
  every: 'PT1H',
  tzid: 'Europe/Paris',
  count: 4,
});
```

Elapsed steps must be positive whole-second ISO time durations, such as `PT30M`
or `PT1H`; calendar units such as `P1D` are rejected. The timezone controls
presentation without moving the elapsed grid.

Calendar rules use the first passage of an ambiguous autumn time and the
pre-transition offset for a spring gap. Later periods keep their nominal clock
time. COUNT and UNTIL are mutually exclusive; COUNT applies before explicit
dates and exclusions. Explicit dates retain their exact instants.

## Compose schedules

Combine recurrences with `union()`, `intersection()` and `difference()`, or add
exceptions with `includingDates()` and `excludingDates()`:

```js
const schedule = recurrence.excludingDates([
  new Date('2026-01-07T08:00:00Z'),
]);

console.log(schedule.take(3).map((value) => value.toString()));
// 5, 9 and 12 January at 09:00 in Europe/Paris
```

The same constructors can be used in a canonical `include`/`exclude` object.
See the [API reference](https://github.com/rrulenet/recurrence/blob/main/docs/API.md)
for constructor shapes and composition examples.

## Query occurrences

| Method | Result |
| --- | --- |
| `take(count)` / `takeAfter(date, count)` | A requested number of occurrences |
| `between(after, before, inc?)` | Occurrences within a bounded range |
| `after(date, inc?)` / `before(date, inc?)` | One occurrence, or `null` |
| `first()` | The first occurrence, or `null` |
| `occursAt(date)` / `hasAnyBetween(...)` | Membership or presence checks |
| `all(callback?)` | Values up to completion, a preview limit, or callback stop |

Occurrence queries return `Temporal.ZonedDateTime` values. Bounds are exclusive
unless `inc` is `true`. For an open-ended recurrence, `all()` without a callback
returns a finite preview of up to 513 values; `count()` without a limit counts
that preview. Prefer explicit bounds for application queries.

`hasAnyBetween()` stops when it finds a match. Pass a callback to `between()`
to stop a bounded query early by returning `false`.

A query that exhausts its search budget throws an error with code
`RECURRENCE_SEARCH_LIMIT`. The built-in engine allows 1,000,000 candidate
evaluations per query across the sources in a recurrence.

## Persist and interchange

```js
const saved = schedule.toJSON();
const restored = Recurrence.fromJSON(saved);
```

Native JSON preserves calendar, elapsed and exact-date expressions, including
algebraic compositions. It carries `temporalVersion: 2`; leave this field intact.
Use `isJSON()` or `validateJSON()` to check received definitions before loading.
Legacy unversioned rule JSON requires an explicit adoption choice, described in
the [JSON reference](https://github.com/rrulenet/recurrence/blob/main/docs/API.md#json-format-and-legacy-inputs).

`toString()` exports RFC-compatible lines when the expression can be represented
without losing meaning. Otherwise it throws `TEMPORAL_UNSERIALIZABLE_EXPRESSION`.
Use `toText()` for a natural-language description.

Use an ISO calendar date string such as `'2025-01-01'` for a calendar rule's
`start` or `until`, or for an included or excluded date without a time. Native
JSON retains the date string and RFC export uses the iCalendar `DATE` form.
Calendar dates resolve in the recurrence's timezone. Supply the same `tzid`
when parsing date-only RFC output from a recurrence in a named timezone.

## Validation and errors

Invalid date/time selectors throw a `RangeError`. API input errors expose a
stable code through `TemporalApiError`. Search-limit errors must be handled
separately from validation failures and empty results. The
[API reference](https://github.com/rrulenet/recurrence/blob/main/docs/API.md#error-handling)
lists the public error codes and validation methods.
