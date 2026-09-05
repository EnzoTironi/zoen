"""Tests of execution-pack controls, NOT the Zoen application."""
from __future__ import annotations
import copy,hashlib,json,tempfile,unittest
from datetime import date
from pathlib import Path
from core import *
ROOT=Path(__file__).resolve().parents[2]
CAT=read_json(ROOT/'planning/catalog.json')
COV=read_json(ROOT/'planning/capability-coverage.json')

class ControlsTests(unittest.TestCase):
 def setUp(self):
  self.temp=tempfile.TemporaryDirectory();self.root=Path(self.temp.name)
  self.ticket=copy.deepcopy(CAT['tickets'][0])
  self.commit='a'*40;self.lock='b'*64
  p=self.root/'proof.txt';p.write_text('Synthetic planner-control fixture; not product evidence.\n')
  sha=hashlib.sha256(p.read_bytes()).hexdigest()
  self.ev={'ticket_id':self.ticket['id'],'source_commit':self.commit,'lock_digest':self.lock,'profile':'planner-fixture','author':'author-A','outcome':'passed','review':{'reviewer':'reviewer-B','source_commit':self.commit,'lock_digest':self.lock,'decision':'approved'},'checks':[{'id':c['id'],'status':'passed','executed_count':1,'skipped_count':0,'layer':c['layer'],'source_commit':self.commit,'lock_digest':self.lock,'artifact':'proof.txt','sha256':sha} for c in self.ticket['checks']]}
 def tearDown(self):self.temp.cleanup()
 def validate(self):validate_evidence(self.ticket,self.ev,self.root,{},today=date(2026,9,4))
 def test_catalog_is_acyclic(self):validate_catalog(CAT)
 def test_duplicate_id_rejected(self):
  b=copy.deepcopy(CAT);b['tickets'].append(b['tickets'][0]);self.assertRaises(PlanError,validate_catalog,b)
 def test_unknown_dependency_rejected(self):
  b=copy.deepcopy(CAT);b['tickets'][0]['depends_on']=['ZN-9999'];self.assertRaises(PlanError,validate_catalog,b)
 def test_cycle_rejected(self):
  b=copy.deepcopy(CAT);b['tickets'][0]['depends_on']=[b['tickets'][1]['id']];self.assertRaises(PlanError,validate_catalog,b)
 def test_empty_oracle_rejected(self):
  b=copy.deepcopy(CAT);b['tickets'][0]['acceptance']['then']='';self.assertRaises(PlanError,validate_catalog,b)
 def test_unknown_gate_rejected(self):
  b=copy.deepcopy(CAT);b['tickets'][0]['external_gate']='G-INVENTED';self.assertRaises(PlanError,validate_catalog,b)
 def test_unsafe_write_path_rejected(self):
  b=copy.deepcopy(CAT);b['tickets'][0]['allowed_paths'].append('../secret');self.assertRaises(PlanError,validate_catalog,b)
 def test_missing_required_output_rejected(self):
  b=copy.deepcopy(CAT);b['tickets'][0]['primary_artifact']='other.ts';self.assertRaises(PlanError,validate_catalog,b)
 def test_full_capability_coverage(self):validate_coverage(CAT,COV)
 def test_missing_capability_rejected(self):self.assertRaises(PlanError,validate_coverage,CAT,COV[:-1])
 def test_false_trace_rejected(self):
  c=copy.deepcopy(COV);c[0]['ticket_ids']=['ZN-0001'];self.assertRaises(PlanError,validate_coverage,CAT,c)
 def test_missing_check_trace_rejected(self):
  c=copy.deepcopy(COV);c[0]['check_ids']=[];self.assertRaises(PlanError,validate_coverage,CAT,c)
 def test_well_formed_evidence_accepted(self):self.validate()
 def test_missing_check_rejected(self):
  self.ev['checks'].pop();self.assertRaises(PlanError,self.validate)
 def test_extra_check_rejected(self):
  c=copy.deepcopy(self.ev['checks'][0]);c['id']='invented';self.ev['checks'].append(c);self.assertRaises(PlanError,self.validate)
 def test_duplicate_check_rejected(self):
  self.ev['checks'].append(copy.deepcopy(self.ev['checks'][0]));self.assertRaises(PlanError,self.validate)
 def test_empty_run_rejected(self):
  self.ev['checks'][0]['executed_count']=0;self.assertRaises(PlanError,self.validate)
 def test_skipped_run_rejected(self):
  self.ev['checks'][0]['skipped_count']=1;self.assertRaises(PlanError,self.validate)
 def test_failed_check_rejected(self):
  self.ev['checks'][0]['status']='failed';self.assertRaises(PlanError,self.validate)
 def test_wrong_layer_rejected(self):
  self.ev['checks'][0]['layer']='law';self.assertRaises(PlanError,self.validate)
 def test_wrong_commit_rejected(self):
  self.ev['checks'][0]['source_commit']='c'*40;self.assertRaises(PlanError,self.validate)
 def test_wrong_lock_rejected(self):
  self.ev['checks'][0]['lock_digest']='c'*64;self.assertRaises(PlanError,self.validate)
 def test_missing_commit_rejected(self):
  self.ev['source_commit']='';self.assertRaises(PlanError,self.validate)
 def test_self_review_rejected(self):
  self.ev['review']['reviewer']=self.ev['author'];self.assertRaises(PlanError,self.validate)
 def test_stale_review_rejected(self):
  self.ev['review']['source_commit']='c'*40;self.assertRaises(PlanError,self.validate)
 def test_rejected_review_rejected(self):
  self.ev['review']['decision']='rejected';self.assertRaises(PlanError,self.validate)
 def test_tampered_artifact_rejected(self):
  (self.root/'proof.txt').write_text('changed');self.assertRaises(PlanError,self.validate)
 def test_missing_artifact_rejected(self):
  (self.root/'proof.txt').unlink();self.assertRaises(PlanError,self.validate)
 def test_path_escape_rejected(self):
  self.ev['checks'][0]['artifact']='../proof.txt';self.assertRaises(PlanError,self.validate)
 def test_absolute_path_rejected(self):self.assertFalse(safe_path('/etc/passwd'))
 def test_windows_path_rejected(self):self.assertFalse(safe_path('C:\\secrets\\x'))
 def test_symlink_rejected(self):
  (self.root/'link.txt').symlink_to(self.root/'proof.txt');self.assertRaises(PlanError,contained_file,self.root,'link.txt')
 def test_wrong_ticket_rejected(self):
  self.ev['ticket_id']='ZN-9999';self.assertRaises(PlanError,self.validate)
 def test_unapproved_gate_rejected(self):
  self.ticket['external_gate']='G-EFFECT';self.assertRaises(PlanError,self.validate)
 def test_approved_gate_requires_scope(self):
  self.ticket['external_gate']='G-EFFECT';g={'G-EFFECT':{'status':'approved','owner':'operator','scope':'provider-A','evidence_refs':['approval'],'valid_until':'2026-12-01'}}
  self.ev['gate_scope']='provider-B';self.assertRaises(PlanError,validate_evidence,self.ticket,self.ev,self.root,g,today=date(2026,9,4))
 def test_expired_gate_not_approved(self):self.assertFalse(gate_approved({'status':'approved','owner':'owner','scope':'x','evidence_refs':['x'],'valid_until':'2020-01-01'},date(2026,9,4)))
 def test_complete_current_gate_approved(self):self.assertTrue(gate_approved({'status':'approved','owner':'owner','scope':'x','evidence_refs':['x'],'valid_until':'2026-09-04'},date(2026,9,4)))
 def test_final_gate_cannot_hide_unapproved_scope(self):
  self.ticket['external_gate']='G-FINAL';g={'G-FINAL':{'status':'approved','owner':'owner','scope':'all','evidence_refs':['x'],'valid_until':'2026-12-01'},'G-EFFECT':{'status':'unapproved'}};self.ev['gate_scope']='all';self.assertRaises(PlanError,validate_evidence,self.ticket,self.ev,self.root,g,today=date(2026,9,4))
 def test_initial_ready_is_baseline_only(self):self.assertEqual([t['id'] for t in ready(CAT,{'tickets':{},'gates':{}})],['ZN-0001'])
 def test_active_lock_blocks_parallel(self):
  a=copy.deepcopy(CAT['tickets'][0]);b=copy.deepcopy(a);b['id']='ZN-9998';b['depends_on']=[];catalog={'tickets':[a,b]};state={'tickets':{a['id']:{'status':'in-progress'}}};self.assertEqual(ready(catalog,state),[])
 def test_disjoint_work_can_parallelize(self):
  a=copy.deepcopy(CAT['tickets'][0]);b=copy.deepcopy(a);b['id']='ZN-9998';b['depends_on']=[];b['resource_locks']=['module:different'];b['allowed_paths']=['different.ts'];self.assertEqual(len(ready({'tickets':[a,b]},{})),2)
 def test_explicit_block_stays_blocked(self):self.assertEqual(ready(CAT,{'tickets':{'ZN-0001':{'status':'blocked'}}}),[])
 def test_scope_rejects_unlisted_file(self):self.assertRaises(PlanError,check_scope,self.ticket,['packages/kernel/escape.ts'])
 def test_scope_accepts_exact_path(self):check_scope(self.ticket,[self.ticket['primary_artifact']])
 def test_scope_rejects_no_diff(self):self.assertRaises(PlanError,check_scope,self.ticket,[])
 def test_acceptance_requires_prerequisites(self):
  self.ticket['depends_on']=['ZN-0002'];b={'tickets':[self.ticket,copy.deepcopy(CAT['tickets'][1])]};state={'tickets':{self.ticket['id']:{'status':'accepted','evidence':self.ev}},'gates':{}};self.assertRaises(PlanError,validate_state,b,state,self.root)
 def test_bare_accepted_status_is_not_proof(self):self.assertRaises(PlanError,validate_state,CAT,{'tickets':{'ZN-0001':{'status':'accepted'}}},self.root)
 def test_packet_is_deterministic_and_bounded(self):
  p=packet(ROOT,CAT,{},'ZN-0001');self.assertEqual(p,packet(ROOT,CAT,{},'ZN-0001'));self.assertLess(len(p.encode()),160000);self.assertNotIn('# ZN-0290 —',p)
 def test_bootstrap_cycle_is_actually_broken(self):
  idx={t['id']:t for t in CAT['tickets']};gen=[t for t in idx.values() if t['spec_id']=='SPEC-002' and t['source_task_index']==1][0];last=[t for t in idx.values() if t['spec_id']=='SPEC-003'][-1];first=[t for t in idx.values() if t['spec_id']=='SPEC-003'][0];presence=[t for t in idx.values() if t['spec_id']=='SPEC-002'][0];self.assertIn(last['id'],gen['depends_on']);self.assertIn(presence['id'],first['depends_on']);validate_catalog(CAT)
 def test_pilot_is_not_blocked_by_enterprise_stage(self):
  first=[t for t in CAT['tickets'] if t['spec_id']=='SPEC-049'][0];idx={t['id']:t for t in CAT['tickets']};self.assertTrue(all(int(idx[x]['slice'][1:])<=1 for x in first['depends_on']))

if __name__=='__main__':unittest.main()
