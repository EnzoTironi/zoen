import type { OperationDescriptor } from '../../../contracts/src/semantic.js';
const descriptor = (id: string, kind: 'read' | 'mutation', scope: 'bootstrap' | 'world', requiresBasis = false): OperationDescriptor => Object.freeze({ id, kind, scope, requiresBasis, published: true, inputSchemaId: `zoen.input.${id}.v1` });
/** Only operations with handler source are advertised. These handlers still require real-service qualification; future v4 capabilities are not placeholder tools. */
export const OPERATIONS: readonly OperationDescriptor[] = Object.freeze([
  descriptor('CreatePersonalWorld', 'mutation', 'bootstrap'),
  descriptor('Discover', 'read', 'world'), descriptor('RegisterSource', 'mutation', 'world'),
  descriptor('CreateSubject', 'mutation', 'world'), descriptor('StageEvidence', 'mutation', 'world'),
  descriptor('AdmitClaim', 'mutation', 'world'), descriptor('CorrectClaim', 'mutation', 'world', true),
  descriptor('Inspect', 'read', 'world'), descriptor('OpenFrame', 'read', 'world'), descriptor('OpenEvidence', 'read', 'world'),
]);
export const FOUNDATION = Object.freeze({
  abi: 'zoen.s0.candidate.1',
  operations: OPERATIONS,
  objectTypes: ['record'],
  predicates: [
    { id: 'record.amount', valueType: 'decimal', units: ['brl', 'usd', 'eur'] },
    { id: 'record.quantity', valueType: 'decimal', units: ['count', 'kilogram', 'gram'] },
    { id: 'record.status', valueType: 'string', units: [] },
    { id: 'record.label', valueType: 'string', units: [] },
    { id: 'record.confirmed', valueType: 'boolean', units: [] },
  ],
});
export function operation(id: string): OperationDescriptor | undefined { return OPERATIONS.find(op => op.id === id); }
