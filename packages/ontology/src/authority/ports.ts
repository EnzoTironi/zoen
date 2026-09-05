/** Authority ports — schema discipline surface (ZN-0019). */
export type {
  MigrationPhase,
  SchemaDisciplineReport,
} from './schema.js';
export {
  applyMigrationPlan,
  recordMigrationPhase,
  assertAuthorityTables,
  probeSchemaDiscipline,
} from './schema.js';
