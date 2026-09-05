#!/usr/bin/env python3
"""Validate planning schemas/examples; no provider simulation or product acceptance."""
from __future__ import annotations
import importlib.metadata
import json
import sys
from pathlib import Path
try:
    from jsonschema import Draft202012Validator
except ImportError:
    raise SystemExit('BLOCKED: install the real tooling dependency with python -m pip install -r tooling/requirements.txt')
ROOT = Path(__file__).resolve().parents[1]

def read(path: Path):
    return json.loads(path.read_text(encoding='utf-8'))

def main() -> int:
    schemas = {p.name: read(p) for p in sorted((ROOT/'docs/schemas').glob('*.json'))}
    for schema in schemas.values():
        Draft202012Validator.check_schema(schema)
    checks = []
    def check(name, schema, value):
        errors = sorted(Draft202012Validator(schemas[schema]).iter_errors(value), key=lambda e: str(list(e.absolute_path)))
        if errors:
            raise ValueError(f'{name}: ' + '; '.join(f'{list(e.absolute_path)}: {e.message}' for e in errors[:8]))
        checks.append(name)
    check('planning/catalog.json', 'backlog.schema.json', read(ROOT/'planning/catalog.json'))
    check('planning/state.json', 'state.schema.json', read(ROOT/'planning/state.json'))
    for entry in read(ROOT/'docs/fixtures/v4/validation-index.json'):
        check(entry['fixture'], Path(entry['schema']).name, read(ROOT/'docs'/entry['fixture']))
    for path, schema in [('docs/architecture/state-machines.json','state-machine.schema.json'),
                         ('docs/testing/fault-matrix.json','fault.schema.json'),
                         ('docs/fixtures/oracles.json','fixture.schema.json')]:
        for index, item in enumerate(read(ROOT/path)):
            check(f'{path}[{index}]', schema, item)
    print(json.dumps({'status':'passed', 'jsonschema_version':importlib.metadata.version('jsonschema'),
                      'schemas_checked':len(schemas), 'record_validations':len(checks), 'records':checks,
                      'scope':'Document contracts and synthetic fixture structure, not executed product scenarios.'}, indent=2))
    return 0
if __name__ == '__main__':
    try:
        sys.exit(main())
    except (OSError, ValueError) as e:
        print('FAILED: '+str(e), file=sys.stderr)
        sys.exit(1)
