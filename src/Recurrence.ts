import { SetEngine, type SetExpression } from '@rrulenet/core/engine';
import { describeSetExpression, isSetExpressionFullyConvertible, type ToTextOptions } from '@rrulenet/core/text';
import { Temporal } from 'temporal-polyfill';

import { TEMPORAL_ERROR_CODES, recurrenceError } from './errors.ts';
import { recurrenceFromParsedOptions } from './parse.ts';
import { coreOptionsToRuleInput } from './rules.ts';
import { renderDateList, renderDtstart } from './serialize.ts';
import { buildState, expressionFromState, type RecurrenceState, validateDateArray } from './state.ts';
import { coerceBoundary, validateOptionsObject } from './temporal-coercion.ts';
import type {
  RecurrenceEntry,
  RecurrenceInput,
  RecurrenceJson,
  RecurrenceJsonEntry,
  RecurrenceJsonRuleInput,
  RecurrenceParseOptions,
  RecurrenceRuleInput,
  RecurrenceWeekdayValue,
  TemporalDateLike,
} from './types.ts';

type RecurrenceStructure =
  | { kind: 'input'; input: RecurrenceInput }
  | { kind: 'union' | 'intersection'; expressions: RecurrenceStructure[] }
  | { kind: 'difference'; include: RecurrenceStructure; exclude: RecurrenceStructure };

/**
 * Temporal-first recurrence expression with first-class set algebra.
 *
 * `Recurrence` is the central public type exposed by `@rrulenet/recurrence`.
 * It can be constructed from a canonical input shape, parsed from RFC strings,
 * queried for occurrences, serialized, and combined with other recurrence
 * expressions through union, intersection, and difference.
 */
export class Recurrence {
  private state: RecurrenceState | null = null;
  private expression!: SetExpression;
  private structure!: RecurrenceStructure;

  /**
   * Create a recurrence from an already-built internal state.
   *
   * This is primarily used by parsing and normalization helpers.
   */
  static fromState(state: RecurrenceState): Recurrence {
    const recurrence = Object.create(Recurrence.prototype) as Recurrence;
    recurrence.state = state;
    recurrence.expression = expressionFromState(state);
    recurrence.structure = { kind: 'input', input: inputFromState(state) };
    return recurrence;
  }

  private static fromExpression(
    expression: SetExpression,
    state: RecurrenceState | null = null,
    structure?: RecurrenceStructure,
  ): Recurrence {
    const recurrence = Object.create(Recurrence.prototype) as Recurrence;
    recurrence.state = state;
    recurrence.expression = expression;
    recurrence.structure = structure ?? (state ? { kind: 'input', input: inputFromState(state) } : { kind: 'union', expressions: [] });
    return recurrence;
  }

  private static fromStructure(structure: RecurrenceStructure): Recurrence {
    switch (structure.kind) {
      case 'input':
        return new Recurrence(cloneInput(structure.input));
      case 'union':
        return Recurrence.fromExpression({
          kind: 'union',
          expressions: structure.expressions.map((expression) => Recurrence.fromStructure(expression).expression),
        }, null, cloneStructure(structure));
      case 'intersection':
        return Recurrence.fromExpression({
          kind: 'intersection',
          expressions: structure.expressions.map((expression) => Recurrence.fromStructure(expression).expression),
        }, null, cloneStructure(structure));
      case 'difference':
        return Recurrence.fromExpression({
          kind: 'difference',
          include: Recurrence.fromStructure(structure.include).expression,
          exclude: Recurrence.fromStructure(structure.exclude).expression,
        }, null, cloneStructure(structure));
    }
  }

  /**
   * Build a recurrence from the canonical input shape.
   */
  constructor(input: RecurrenceInput) {
    validateOptionsObject(input, 'constructor');
    const state = buildState(input);
    this.state = state;
    this.expression = expressionFromState(state);
    this.structure = { kind: 'input', input: inputFromState(state) };
  }

  /**
   * Parse an RFC 5545 recurrence string into a `Recurrence`.
   */
  static parse(options: RecurrenceParseOptions): Recurrence {
    return recurrenceFromParsedOptions(options, Recurrence.fromState);
  }

  /**
   * Create a single-rule recurrence.
   */
  static rule(options: RecurrenceRuleInput): Recurrence {
    validateOptionsObject(options, 'rule');
    return new Recurrence({
      start: options.start,
      tzid: options.tzid,
      include: [{ rule: options }],
    });
  }

  /**
   * Create a recurrence from explicit dates only.
   */
  static dates(values: TemporalDateLike[], options: { start?: TemporalDateLike | null; tzid?: string | null } = {}): Recurrence {
    validateDateArray(values, 'Recurrence.dates()');
    validateOptionsObject(options, 'dates');
    return new Recurrence({
      start: options.start,
      tzid: options.tzid,
      include: [{ dates: values }],
    });
  }

  /**
   * Rebuild a recurrence from its JSON representation.
   */
  static fromJSON(json: RecurrenceJson): Recurrence {
    return Recurrence.fromStructure(structureFromJson(json));
  }

  /**
   * Report whether a value is accepted by {@link Recurrence.fromJSON}.
   */
  static isJSON(value: unknown): value is RecurrenceJson {
    return Recurrence.validateJSON(value).ok;
  }

  /**
   * Validate a value as recurrence JSON without throwing.
   */
  static validateJSON(value: unknown): { ok: true } | { ok: false; error: Error } {
    try {
      Recurrence.fromJSON(value as RecurrenceJson);
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Create the union of multiple recurrence expressions.
   */
  static union(...recurrences: Recurrence[]): Recurrence {
    if (!recurrences.length) {
      recurrenceError(TEMPORAL_ERROR_CODES.INVALID_OPTIONS, 'Recurrence.union() expects at least one recurrence');
    }
    return Recurrence.fromExpression({
      kind: 'union',
      expressions: recurrences.map((recurrence) => recurrence.expression),
    }, null, {
      kind: 'union',
      expressions: recurrences.map((recurrence) => cloneStructure(recurrence.structure)),
    });
  }

  /**
   * Create the intersection of multiple recurrence expressions.
   */
  static intersection(...recurrences: Recurrence[]): Recurrence {
    if (!recurrences.length) {
      recurrenceError(TEMPORAL_ERROR_CODES.INVALID_OPTIONS, 'Recurrence.intersection() expects at least one recurrence');
    }
    return Recurrence.fromExpression({
      kind: 'intersection',
      expressions: recurrences.map((recurrence) => recurrence.expression),
    }, null, {
      kind: 'intersection',
      expressions: recurrences.map((recurrence) => cloneStructure(recurrence.structure)),
    });
  }

  /**
   * Subtract one recurrence expression from another.
   */
  static difference(include: Recurrence, exclude: Recurrence): Recurrence {
    return Recurrence.fromExpression({
      kind: 'difference',
      include: include.expression,
      exclude: exclude.expression,
    }, null, {
      kind: 'difference',
      include: cloneStructure(include.structure),
      exclude: cloneStructure(exclude.structure),
    });
  }

  /**
   * Resolved start of the flat recurrence, when present.
   */
  get start(): Temporal.ZonedDateTime | null {
    return this.state?.start ?? null;
  }

  /**
   * Resolved timezone identifier of the flat recurrence, when present.
   */
  get tzid(): string | null {
    return this.state?.tzid ?? null;
  }

  /**
   * Return all occurrences, optionally short-circuiting through an iterator.
   */
  all(iterator?: (value: Temporal.ZonedDateTime, index: number) => boolean): Temporal.ZonedDateTime[] {
    const values = new SetEngine(this.expression).all();
    return iterator ? applyIterator(values, iterator) : values;
  }

  /**
   * Return occurrences between two boundaries.
   */
  between(after: TemporalDateLike, before: TemporalDateLike, inc = false, iterator?: (value: Temporal.ZonedDateTime, index: number) => boolean): Temporal.ZonedDateTime[] {
    const values = new SetEngine(this.expression).between(
      coerceBoundary(after, this.state?.tzid),
      coerceBoundary(before, this.state?.tzid),
      inc,
    );
    return iterator ? applyIterator(values, iterator) : values;
  }

  /**
   * Return the first occurrence strictly after, or optionally equal to, the
   * provided boundary.
   */
  after(date: TemporalDateLike, inc = false): Temporal.ZonedDateTime | null {
    return new SetEngine(this.expression).after(coerceBoundary(date, this.state?.tzid), inc);
  }

  /**
   * Return the last occurrence strictly before, or optionally equal to, the
   * provided boundary.
   */
  before(date: TemporalDateLike, inc = false): Temporal.ZonedDateTime | null {
    return new SetEngine(this.expression).before(coerceBoundary(date, this.state?.tzid), inc);
  }

  /**
   * Return the first occurrence, if any.
   */
  first(): Temporal.ZonedDateTime | null {
    return this.all((_, index) => index < 1)[0] ?? null;
  }

  /**
   * Return the first `count` occurrences.
   */
  take(count: number): Temporal.ZonedDateTime[] {
    assertNonNegativeInteger(count, 'take()');
    if (count === 0) return [];
    return this.all((_, index) => index < count);
  }

  /**
   * Return the next `count` occurrences after a boundary.
   */
  takeAfter(date: TemporalDateLike, count: number, inc = false): Temporal.ZonedDateTime[] {
    assertNonNegativeInteger(count, 'takeAfter()');
    if (count === 0) return [];

    const out: Temporal.ZonedDateTime[] = [];
    let boundary = coerceBoundary(date, this.state?.tzid);
    let inclusive = inc;

    while (out.length < count) {
      const value = new SetEngine(this.expression).after(boundary, inclusive);
      if (!value) break;
      out.push(value);
      boundary = value.toInstant();
      inclusive = false;
    }

    return out;
  }

  /**
   * Count occurrences, optionally stopping after the provided limit.
   */
  count(limit?: number): number {
    if (limit === undefined) return this.all().length;
    assertNonNegativeInteger(limit, 'count()');
    return this.take(limit).length;
  }

  /**
   * Report whether the recurrence yields at least one occurrence.
   */
  hasAny(): boolean {
    return this.first() !== null;
  }

  /**
   * Report whether the recurrence yields no occurrences.
   */
  isEmpty(): boolean {
    return !this.hasAny();
  }

  /**
   * Report whether at least one occurrence exists within the given range.
   */
  hasAnyBetween(after: TemporalDateLike, before: TemporalDateLike, inc = false): boolean {
    return this.between(after, before, inc, (_, index) => index < 1).length > 0;
  }

  /**
   * Report whether an occurrence exists exactly at the provided boundary.
   */
  occursAt(date: TemporalDateLike): boolean {
    const boundary = coerceBoundary(date, this.state?.tzid);
    const value = new SetEngine(this.expression).after(boundary, true);
    return value ? Temporal.Instant.compare(value.toInstant(), boundary) === 0 : false;
  }

  /**
   * Return a new recurrence with additional explicit included dates.
   */
  includingDates(values: TemporalDateLike[]): Recurrence {
    validateDateArray(values, 'includingDates()');
    if (!this.state) return Recurrence.union(this, Recurrence.dates(values));
    return new Recurrence({
      start: this.state.start,
      tzid: this.state.tzid,
      include: [...this.toInput().include, { dates: values }],
      exclude: this.toInput().exclude,
    });
  }

  /**
   * Return a new recurrence with additional explicit excluded dates.
   */
  excludingDates(values: TemporalDateLike[]): Recurrence {
    validateDateArray(values, 'excludingDates()');
    if (!this.state) return Recurrence.difference(this, Recurrence.dates(values));
    return new Recurrence({
      start: this.state.start,
      tzid: this.state.tzid,
      include: this.toInput().include,
      exclude: [...(this.toInput().exclude ?? []), { dates: values }],
    });
  }

  /**
   * Return the union of this recurrence and additional operands.
   */
  union(...recurrences: Recurrence[]): Recurrence {
    return Recurrence.union(this, ...recurrences);
  }

  /**
   * Return the intersection of this recurrence and additional operands.
   */
  intersection(...recurrences: Recurrence[]): Recurrence {
    return Recurrence.intersection(this, ...recurrences);
  }

  /**
   * Return this recurrence minus another recurrence.
   */
  difference(exclude: Recurrence): Recurrence {
    return Recurrence.difference(this, exclude);
  }

  /**
   * Clone the recurrence expression.
   */
  clone(): Recurrence {
    return Recurrence.fromStructure(this.structure);
  }

  /**
   * Compare two recurrence expressions by their public JSON form.
   */
  equals(other: Recurrence): boolean {
    return JSON.stringify(this.toJSON()) === JSON.stringify(other.toJSON());
  }

  /**
   * Normalize nested algebraic structures where possible.
   */
  normalize(): Recurrence {
    return Recurrence.fromStructure(normalizeStructure(this.structure));
  }

  /**
   * Alias for {@link normalize}.
   */
  flatten(): Recurrence {
    return this.normalize();
  }

  toText(options?: ToTextOptions): string {
    return describeSetExpression(this.expression, options);
  }

  isFullyConvertibleToText(options?: ToTextOptions): boolean {
    return isSetExpressionFullyConvertible(this.expression, options);
  }

  toString(): string {
    if (!this.state) {
      recurrenceError(
        TEMPORAL_ERROR_CODES.UNSERIALIZABLE_EXPRESSION,
        'This Recurrence expression cannot be serialized as a flat RFC string',
      );
    }
    const lines: string[] = [];
    if (this.state.start) lines.push(renderDtstart(this.state.start));

    for (const entry of this.state.include) {
      if (entry.kind === 'rule') {
        const line = entry.source.toSerializedString()
          .split('\n')
          .filter((current: string) => !current.startsWith('DTSTART:') && !current.startsWith('DTSTART;'))
          .join('\n');
        if (line) lines.push(line);
      } else if (entry.values.length) {
        lines.push(renderDateList('RDATE', entry.values, this.state.tzid));
      }
    }

    for (const entry of this.state.exclude) {
      if (entry.kind === 'rule') {
        const line = entry.source.toSerializedString()
          .split('\n')
          .filter((current: string) => !current.startsWith('DTSTART:') && !current.startsWith('DTSTART;'))
          .map((current: string) => current.replace(/^RRULE:/, 'EXRULE:'))
          .join('\n');
        if (line) lines.push(line);
      } else if (entry.values.length) {
        lines.push(renderDateList('EXDATE', entry.values, this.state.tzid));
      }
    }

    return lines.filter(Boolean).join('\n');
  }

  toInput(): RecurrenceInput {
    if (this.structure.kind !== 'input') {
      recurrenceError(
        TEMPORAL_ERROR_CODES.UNSERIALIZABLE_EXPRESSION,
        'This Recurrence expression cannot be represented as a flat input object',
      );
    }
    return cloneInput(this.structure.input);
  }

  toJSON(): RecurrenceJson {
    return structureToJson(this.structure);
  }
}

function applyIterator<T>(values: T[], iterator: (value: T, index: number) => boolean): T[] {
  const accepted: T[] = [];
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index]!;
    if (!iterator(value, index)) break;
    accepted.push(value);
  }
  return accepted;
}

function assertNonNegativeInteger(value: number, label: string) {
  if (!Number.isInteger(value) || value < 0) {
    recurrenceError(TEMPORAL_ERROR_CODES.INVALID_OPTIONS, `${label} expects a non-negative integer`);
  }
}

function inputFromState(state: RecurrenceState): RecurrenceInput {
  return {
    start: state.start,
    tzid: state.tzid,
    include: state.include.map((entry) => (
      entry.kind === 'rule'
        ? { rule: coreOptionsToRuleInput(entry.options) }
        : { dates: entry.values }
    )),
    exclude: state.exclude.map((entry) => (
      entry.kind === 'rule'
        ? { rule: coreOptionsToRuleInput(entry.options) }
        : { dates: entry.values }
    )),
  };
}

function cloneDateLike(value: TemporalDateLike | null | undefined): TemporalDateLike | null | undefined {
  if (value instanceof Date) return new Date(value.getTime());
  return value;
}

function cloneWeekdayValue(value: RecurrenceWeekdayValue): RecurrenceWeekdayValue {
  if (typeof value === 'object' && value !== null) {
    return { weekday: value.weekday, ordinal: value.ordinal };
  }
  return value;
}

function cloneRuleInput(input: RecurrenceRuleInput): RecurrenceRuleInput {
  return {
    ...input,
    start: cloneDateLike(input.start),
    until: cloneDateLike(input.until),
    bySetPos: Array.isArray(input.bySetPos) ? [...input.bySetPos] : input.bySetPos,
    byMonth: Array.isArray(input.byMonth) ? [...input.byMonth] : input.byMonth,
    byMonthDay: Array.isArray(input.byMonthDay) ? [...input.byMonthDay] : input.byMonthDay,
    byYearDay: Array.isArray(input.byYearDay) ? [...input.byYearDay] : input.byYearDay,
    byWeekNo: Array.isArray(input.byWeekNo) ? [...input.byWeekNo] : input.byWeekNo,
    byDay: Array.isArray(input.byDay) ? input.byDay.map(cloneWeekdayValue) : (input.byDay ? cloneWeekdayValue(input.byDay) : input.byDay),
    byHour: Array.isArray(input.byHour) ? [...input.byHour] : input.byHour,
    byMinute: Array.isArray(input.byMinute) ? [...input.byMinute] : input.byMinute,
    bySecond: Array.isArray(input.bySecond) ? [...input.bySecond] : input.bySecond,
  };
}

function cloneEntry(entry: RecurrenceEntry): RecurrenceEntry {
  if ('rule' in entry) return { rule: cloneRuleInput(entry.rule) };
  return { dates: entry.dates.map((value) => cloneDateLike(value) as TemporalDateLike) };
}

function cloneInput(input: RecurrenceInput): RecurrenceInput {
  return {
    start: cloneDateLike(input.start),
    tzid: input.tzid ?? undefined,
    include: input.include.map(cloneEntry),
    exclude: input.exclude?.map(cloneEntry),
  };
}

function cloneStructure(structure: RecurrenceStructure): RecurrenceStructure {
  switch (structure.kind) {
    case 'input':
      return { kind: 'input', input: cloneInput(structure.input) };
    case 'union':
    case 'intersection':
      return { kind: structure.kind, expressions: structure.expressions.map(cloneStructure) };
    case 'difference':
      return {
        kind: 'difference',
        include: cloneStructure(structure.include),
        exclude: cloneStructure(structure.exclude),
      };
  }
}

function normalizeStructure(structure: RecurrenceStructure): RecurrenceStructure {
  switch (structure.kind) {
    case 'input':
      return cloneStructure(structure);
    case 'union':
    case 'intersection': {
      const normalized = structure.expressions.map(normalizeStructure);
      const flattened = normalized.flatMap((expression) => expression.kind === structure.kind ? expression.expressions : [expression]);
      if (flattened.length === 1) return flattened[0]!;
      return {
        kind: structure.kind,
        expressions: flattened,
      };
    }
    case 'difference':
      return {
        kind: 'difference',
        include: normalizeStructure(structure.include),
        exclude: normalizeStructure(structure.exclude),
      };
  }
}

function serializeDateLike(value: TemporalDateLike | null | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return value instanceof Date ? Temporal.Instant.from(value.toISOString()).toString() : value.toString();
}

function serializeRuleInput(input: RecurrenceRuleInput): RecurrenceJsonRuleInput {
  return {
    ...input,
    start: serializeDateLike(input.start),
    until: serializeDateLike(input.until),
    bySetPos: Array.isArray(input.bySetPos) ? [...input.bySetPos] : input.bySetPos,
    byMonth: Array.isArray(input.byMonth) ? [...input.byMonth] : input.byMonth,
    byMonthDay: Array.isArray(input.byMonthDay) ? [...input.byMonthDay] : input.byMonthDay,
    byYearDay: Array.isArray(input.byYearDay) ? [...input.byYearDay] : input.byYearDay,
    byWeekNo: Array.isArray(input.byWeekNo) ? [...input.byWeekNo] : input.byWeekNo,
    byDay: Array.isArray(input.byDay) ? input.byDay.map(cloneWeekdayValue) : (input.byDay ? cloneWeekdayValue(input.byDay) : input.byDay),
    byHour: Array.isArray(input.byHour) ? [...input.byHour] : input.byHour,
    byMinute: Array.isArray(input.byMinute) ? [...input.byMinute] : input.byMinute,
    bySecond: Array.isArray(input.bySecond) ? [...input.bySecond] : input.bySecond,
  };
}

function serializeEntry(entry: RecurrenceEntry): RecurrenceJsonEntry {
  if ('rule' in entry) return { rule: serializeRuleInput(entry.rule) };
  return { dates: entry.dates.map((value) => serializeDateLike(value)!) };
}

function structureToJson(structure: RecurrenceStructure): RecurrenceJson {
  switch (structure.kind) {
    case 'input':
      return {
        kind: 'input',
        start: serializeDateLike(structure.input.start) ?? null,
        tzid: structure.input.tzid ?? null,
        include: structure.input.include.map(serializeEntry),
        exclude: (structure.input.exclude ?? []).map(serializeEntry),
      };
    case 'union':
    case 'intersection':
      return {
        kind: structure.kind,
        expressions: structure.expressions.map(structureToJson),
      };
    case 'difference':
      return {
        kind: 'difference',
        include: structureToJson(structure.include),
        exclude: structureToJson(structure.exclude),
      };
  }
}

function structureFromJson(json: RecurrenceJson): RecurrenceStructure {
  if (!json || typeof json !== 'object' || !('kind' in json)) {
    recurrenceError(TEMPORAL_ERROR_CODES.INVALID_OPTIONS, 'Recurrence.fromJSON() expects a valid recurrence JSON object');
  }

  switch (json.kind) {
    case 'input':
      return {
        kind: 'input',
        input: {
          start: reviveDateLike(json.start),
          tzid: json.tzid,
          include: json.include.map(reviveJsonEntry),
          exclude: json.exclude.map(reviveJsonEntry),
        },
      };
    case 'union':
    case 'intersection':
      return {
        kind: json.kind,
        expressions: json.expressions.map(structureFromJson),
      };
    case 'difference':
      return {
        kind: 'difference',
        include: structureFromJson(json.include),
        exclude: structureFromJson(json.exclude),
      };
  }
}

function reviveJsonEntry(entry: RecurrenceJsonEntry): RecurrenceEntry {
  if ('rule' in entry) {
    return { rule: reviveJsonRuleInput(entry.rule) };
  }
  return { dates: entry.dates.map((value) => reviveDateLike(value) as TemporalDateLike) };
}

function reviveJsonRuleInput(input: RecurrenceJsonRuleInput): RecurrenceRuleInput {
  return {
    ...input,
    start: reviveDateLike(input.start),
    until: reviveDateLike(input.until),
    bySetPos: Array.isArray(input.bySetPos) ? [...input.bySetPos] : input.bySetPos,
    byMonth: Array.isArray(input.byMonth) ? [...input.byMonth] : input.byMonth,
    byMonthDay: Array.isArray(input.byMonthDay) ? [...input.byMonthDay] : input.byMonthDay,
    byYearDay: Array.isArray(input.byYearDay) ? [...input.byYearDay] : input.byYearDay,
    byWeekNo: Array.isArray(input.byWeekNo) ? [...input.byWeekNo] : input.byWeekNo,
    byDay: Array.isArray(input.byDay) ? input.byDay.map(cloneWeekdayValue) : (input.byDay ? cloneWeekdayValue(input.byDay) : input.byDay),
    byHour: Array.isArray(input.byHour) ? [...input.byHour] : input.byHour,
    byMinute: Array.isArray(input.byMinute) ? [...input.byMinute] : input.byMinute,
    bySecond: Array.isArray(input.bySecond) ? [...input.bySecond] : input.bySecond,
  };
}

function reviveDateLike(value: string | null | undefined): TemporalDateLike | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return value.includes('[') ? Temporal.ZonedDateTime.from(value) : Temporal.Instant.from(value);
}
