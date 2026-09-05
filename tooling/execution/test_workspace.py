"""Actual filesystem/control tests, not mocked Zoen integrations or product acceptance."""
import copy, importlib.util, json, sys, tempfile, unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'tooling'))
from workspace import plan_is_comments,safe_target,validate_file_map,context_packet,walk_active,PlanError

def module(name,path):
 spec=importlib.util.spec_from_file_location(name,path);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m
seal=module('workspace_seal',ROOT/'tooling/seal-workspace.py')

class PlanControls(unittest.TestCase):
 def test_ts_comments_are_plans(self):self.assertTrue(plan_is_comments('x.ts','// @zoen-plan x.ts\n// PROCEDURE X\n\n'))
 def test_tsx_comments_are_plans(self):self.assertTrue(plan_is_comments('x.tsx','// @zoen-plan x.tsx\n// render approved component'))
 def test_python_comments_are_plans(self):self.assertTrue(plan_is_comments('x.py','# @zoen-plan x.py\n# await an admitted profile'))
 def test_R_comments_are_plans(self):self.assertTrue(plan_is_comments('x.R','# @zoen-plan x.R\n# no executable expression'))
 def test_code_after_marker_rejected(self):self.assertFalse(plan_is_comments('x.ts','// @zoen-plan x.ts\nexport const success = true;'))
 def test_import_after_marker_rejected(self):self.assertFalse(plan_is_comments('x.ts','// @zoen-plan x.ts\nimport "pg";'))
 def test_false_runtime_stub_rejected(self):self.assertFalse(plan_is_comments('x.ts','// @zoen-plan x.ts\nexport function run(){return {ok:true}}'))
 def test_empty_file_is_not_plan(self):self.assertFalse(plan_is_comments('x.ts',''))
 def test_comment_without_marker_is_not_plan(self):self.assertFalse(plan_is_comments('x.ts','// no implementation yet'))
 def test_unicode_line_separator_cannot_hide_code(self):self.assertFalse(plan_is_comments('x.ts','// @zoen-plan x.ts\n// x\u2028export const value=1;'))
 def test_python_execution_rejected(self):self.assertFalse(plan_is_comments('x.py','# @zoen-plan x.py\nprint("ok")'))
 def test_bom_before_marker_rejected(self):self.assertFalse(plan_is_comments('x.ts','\ufeff// @zoen-plan x.ts'))
 def test_all_catalog_plans_cover_all_required_paths(self):
  b=json.loads((ROOT/'planning/catalog.json').read_text());m=json.loads((ROOT/'planning/files.json').read_text());self.assertEqual(validate_file_map(b,m,ROOT)['ticket_paths'],2291)
 def test_stable_tests_are_all_planned_not_passed(self):
  c=json.loads((ROOT/'planning/check-map.json').read_text());self.assertEqual(len(c),975);self.assertTrue(all(x['status']=='not-executed' for x in c))
 def test_all_future_runtime_sources_are_comment_only(self):
  fs=json.loads((ROOT/'planning/files.json').read_text())['files']
  for f in fs:
   if f['representation']=='comment-only-source':self.assertTrue(plan_is_comments(f['target'],(ROOT/f['plan_path']).read_text()))
 def test_no_fake_lock(self):self.assertFalse((ROOT/'pnpm-lock.yaml').exists());self.assertTrue((ROOT/'pnpm-lock.yaml.plan.md').is_file())
 def test_no_empty_migrations_activated(self):self.assertEqual(sorted(x.name for x in (ROOT/'db/migrations').glob('*.sql')),['0001_authority.sql','0002_door.sql'])
 def test_core_source_excludes_plans(self):
  includes=json.loads((ROOT/'tsconfig.core.json').read_text())['include'];self.assertTrue(all('@zoen-plan' not in (ROOT/x).read_text()[:100] for x in includes))
 def test_packet_is_bounded_and_contains_algorithm_and_test_oracles(self):
  b=json.loads((ROOT/'planning/catalog.json').read_text());p=context_packet(ROOT,b,{},'ZN-0022');self.assertIn('ZN-0022-BOUNDARY',p);self.assertIn('docs/algorithms/spec-003.md',p);self.assertIn('guards.ts.plan.md',p);self.assertLess(len(p.encode()),160000)
 def test_packet_too_small_limit_fails_not_truncates(self):
  b=json.loads((ROOT/'planning/catalog.json').read_text());self.assertRaises(PlanError,context_packet,ROOT,b,{},'ZN-0022',10)
 def test_unknown_ticket_rejected(self):
  b=json.loads((ROOT/'planning/catalog.json').read_text());self.assertRaises(PlanError,context_packet,ROOT,b,{},'ZN-9000')
 def test_packet_excludes_other_tickets_full_bodies(self):
  b=json.loads((ROOT/'planning/catalog.json').read_text());p=context_packet(ROOT,b,{},'ZN-0001');self.assertNotIn('# ZN-0325 —',p)
 def test_packet_does_not_bulk_extract_archives(self):
  self.assertFalse((ROOT/'baseline').exists());self.assertFalse((ROOT/'specification').exists())

class PathAndSealControls(unittest.TestCase):
 def setUp(self):self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup);self.root=Path(self.temp.name)
 def put(self,p,text='actual filesystem control input'):
  x=self.root/p;x.parent.mkdir(parents=True,exist_ok=True);x.write_text(text);return x
 def initseal(self):self.put('DELIVERY-MANIFEST.json',json.dumps(seal.make(self.root)))
 def test_ordinary_relative_path(self):self.assertEqual(safe_target(self.root,'source/a.ts'),self.root/'source/a.ts')
 def test_parent_escape_rejected(self):self.assertRaises(PlanError,safe_target,self.root,'../a')
 def test_absolute_escape_rejected(self):self.assertRaises(PlanError,safe_target,self.root,'/a')
 def test_drive_escape_rejected(self):self.assertRaises(PlanError,safe_target,self.root,'C:/a')
 def test_symlink_leaf_rejected(self):
  self.put('a');(self.root/'b').symlink_to('a');self.assertRaises(PlanError,safe_target,self.root,'b')
 def test_symlink_parent_rejected(self):
  self.put('a/x');(self.root/'b').symlink_to('a',target_is_directory=True);self.assertRaises(PlanError,safe_target,self.root,'b/x')
 def test_source_artifacts_directory_not_excluded(self):
  self.put('packages/ontology/src/artifacts/a.ts');self.assertEqual(len(list(walk_active(self.root))),1)
 def test_root_artifacts_are_excluded_from_navigation(self):
  self.put('artifacts/run.txt');self.put('source.ts');self.assertEqual([x.name for x in walk_active(self.root)],['source.ts'])
 def test_valid_seal(self):self.put('source.ts');self.initseal();self.assertEqual(seal.check(self.root)['static_files'],1)
 def test_changed_file_fails_seal(self):self.put('source.ts');self.initseal();self.put('source.ts','changed');self.assertRaises(ValueError,seal.check,self.root)
 def test_added_file_fails_seal(self):self.put('source.ts');self.initseal();self.put('other.ts');self.assertRaises(ValueError,seal.check,self.root)
 def test_missing_file_fails_seal(self):p=self.put('source.ts');self.initseal();p.unlink();self.assertRaises(ValueError,seal.check,self.root)
 def test_source_artifacts_included_in_seal(self):self.put('packages/ontology/src/artifacts/a.ts');self.initseal();self.assertEqual(seal.check(self.root)['static_files'],1)
 def test_mutable_reports_not_source_proof(self):self.put('source.ts');self.initseal();self.put('evidence/workspace-v5/report.json','{}');self.assertEqual(seal.check(self.root)['static_files'],1)
 def test_exclusion_expansion_rejected(self):
  self.put('source.ts');self.initseal();d=json.loads((self.root/'DELIVERY-MANIFEST.json').read_text());d['excluded_exact'].append('source.ts');self.put('DELIVERY-MANIFEST.json',json.dumps(d));self.assertRaises(ValueError,seal.check,self.root)
 def test_symlink_seal_rejected(self):self.put('source.ts');(self.root/'alias').symlink_to('source.ts');self.assertRaises(ValueError,seal.make,self.root)

if __name__=='__main__':unittest.main()
