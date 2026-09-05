import { canonicalJson, exactKeys, list, object, text, type JsonValue } from '../../../kernel/src/json.js';
import { requireThat, KernelError } from '../../../kernel/src/result.js';
import { semanticId } from '../../../kernel/src/ids.js';
import { add, subtract, compare, multiply, parseDecimal, canonicalDecimal, type Rounding } from '../../../kernel/src/decimal.js';
export type Value = Readonly<{ kind: 'missing'; reason: string }> | Readonly<{ kind: 'decimal'; value: string; unit: string | null }> | Readonly<{ kind: 'string'; value: string }> | Readonly<{ kind: 'boolean'; value: boolean }>;
export type Expr = Readonly<{ op: 'literal'; value: Value }> | Readonly<{ op: 'field'; field: string }>
  | Readonly<{ op: 'add' | 'subtract' | 'eq' | 'lt' | 'and'; left: Expr; right: Expr }>
  | Readonly<{ op: 'multiply'; left: Expr; right: Expr; scale: number; rounding: Rounding }>
  | Readonly<{ op: 'not'; value: Expr }> | Readonly<{ op: 'if'; condition: Expr; yes: Expr; no: Expr }>;
export function parseValue(raw: JsonValue): Value {
  const v = object(raw);
  switch (v['kind']) {
    case 'missing': exactKeys(v, ['kind', 'reason']); return Object.freeze({ kind: 'missing', reason: text(v['reason'], 80) });
    case 'decimal': exactKeys(v, ['kind', 'value', 'unit']); return Object.freeze({ kind: 'decimal', value: canonicalDecimal(parseDecimal(text(v['value'], 41))), unit: v['unit'] === null ? null : semanticId(text(v['unit'])) });
    case 'string': exactKeys(v, ['kind', 'value']); return Object.freeze({ kind: 'string', value: text(v['value'], 10_000) });
    case 'boolean': exactKeys(v, ['kind', 'value']); requireThat(typeof v['value'] === 'boolean', 'EXPRESSION_TYPE'); return Object.freeze({ kind: 'boolean', value: v['value'] });
    default: throw new KernelError('Unsupported', 'UNSUPPORTED_VALUE_KIND');
  }
}
export function parseExpression(raw: JsonValue): Expr {
  let nodes = 0;
  function parse(value: JsonValue, depth: number): Expr {
    requireThat(depth <= 16 && ++nodes <= 256, 'EXPRESSION_LIMIT'); const v = object(value); const op = text(v['op']);
    switch (op) {
      case 'literal': exactKeys(v, ['op', 'value']); return Object.freeze({ op, value: parseValue(v['value']!) });
      case 'field': exactKeys(v, ['op', 'field']); return Object.freeze({ op, field: semanticId(text(v['field'])) });
      case 'add': case 'subtract': case 'eq': case 'lt': case 'and':
        exactKeys(v, ['op', 'left', 'right']); return Object.freeze({ op, left: parse(v['left']!, depth + 1), right: parse(v['right']!, depth + 1) });
      case 'multiply': {
        exactKeys(v, ['op', 'left', 'right', 'scale', 'rounding']); const scale = v['scale'];
        requireThat(typeof scale === 'number' && Number.isInteger(scale) && scale >= 0 && scale <= 18, 'EXPRESSION_SCALE');
        const rounding = text(v['rounding']); requireThat(['reject', 'half-even', 'toward-zero', 'floor', 'ceil'].includes(rounding), 'ROUNDING_MODE');
        return Object.freeze({ op, left: parse(v['left']!, depth + 1), right: parse(v['right']!, depth + 1), scale, rounding: rounding as Rounding });
      }
      case 'not': exactKeys(v, ['op', 'value']); return Object.freeze({ op, value: parse(v['value']!, depth + 1) });
      case 'if': exactKeys(v, ['op', 'condition', 'yes', 'no']); return Object.freeze({ op, condition: parse(v['condition']!, depth + 1), yes: parse(v['yes']!, depth + 1), no: parse(v['no']!, depth + 1) });
      default: throw new KernelError('Unsupported', 'UNSUPPORTED_EXPRESSION_OPERATOR');
    }
  }
  return parse(raw, 0);
}
/** Closed, deterministic interpreter; no eval, SQL, network, loops or implicit coercion. */
export function evaluate(expression: Expr, fields: Readonly<Record<string, Value>>): Readonly<{ value: Value; dependencies: readonly string[] }> {
  const dependencies = new Set<string>(); let steps = 0;
  function ev(expr: Expr, depth: number): Value {
    requireThat(++steps <= 256 && depth <= 16, 'EXPRESSION_LIMIT');
    if (expr.op === 'literal') return expr.value;
    if (expr.op === 'field') { dependencies.add(expr.field); return Object.hasOwn(fields, expr.field) ? fields[expr.field]! : Object.freeze({ kind: 'missing', reason: 'FIELD_UNAVAILABLE' }); }
    if (expr.op === 'not') { const value = ev(expr.value, depth + 1); if (value.kind === 'missing') return value; requireThat(value.kind === 'boolean', 'EXPRESSION_TYPE'); return Object.freeze({ kind: 'boolean', value: !value.value }); }
    if (expr.op === 'if') {
      const condition = ev(expr.condition, depth + 1); if (condition.kind === 'missing') return condition;
      requireThat(condition.kind === 'boolean', 'EXPRESSION_TYPE'); return ev(condition.value ? expr.yes : expr.no, depth + 1);
    }
    const left = ev(expr.left, depth + 1); const right = ev(expr.right, depth + 1);
    if (left.kind === 'missing') return left; if (right.kind === 'missing') return right;
    if (expr.op === 'and') { requireThat(left.kind === 'boolean' && right.kind === 'boolean', 'EXPRESSION_TYPE'); return Object.freeze({ kind: 'boolean', value: left.value && right.value }); }
    if (expr.op === 'eq') { requireThat(left.kind === right.kind, 'EXPRESSION_TYPE'); return Object.freeze({ kind: 'boolean', value: canonicalJson({ ...left }) === canonicalJson({ ...right }) }); }
    requireThat(left.kind === 'decimal' && right.kind === 'decimal', 'EXPRESSION_TYPE');
    if (expr.op === 'multiply') {
      requireThat(left.unit === null || right.unit === null, 'EXPLICIT_UNIT_RULE_REQUIRED');
      return Object.freeze({ kind: 'decimal', value: canonicalDecimal(multiply(parseDecimal(left.value), parseDecimal(right.value), expr.scale, expr.rounding)), unit: left.unit ?? right.unit });
    }
    requireThat(left.unit === right.unit, 'UNIT_MISMATCH');
    if (expr.op === 'lt') return Object.freeze({ kind: 'boolean', value: compare(parseDecimal(left.value), parseDecimal(right.value)) < 0 });
    const calculate = expr.op === 'add' ? add : subtract;
    return Object.freeze({ kind: 'decimal', value: canonicalDecimal(calculate(parseDecimal(left.value), parseDecimal(right.value))), unit: left.unit });
  }
  const value = ev(expression, 0); return Object.freeze({ value, dependencies: Object.freeze([...dependencies].sort()) });
}
export function fieldDependencies(expression: Expr): readonly string[] {
  const dependencies = new Set<string>();
  function visit(expr: Expr): void {
    switch (expr.op) {
      case 'field': dependencies.add(expr.field); return;
      case 'literal': return;
      case 'not': visit(expr.value); return;
      case 'if': visit(expr.condition); visit(expr.yes); visit(expr.no); return;
      default: visit(expr.left); visit(expr.right);
    }
  }
  visit(expression); return Object.freeze([...dependencies].sort());
}
export function parseFieldList(raw: JsonValue): readonly string[] { return Object.freeze(list(raw, 100).map(v => semanticId(text(v)))); }
