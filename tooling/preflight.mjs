import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
export function preflight({ real = false } = {}) {
  const blockers=[];
  if (Number(process.versions.node.split('.')[0]) !== 24) blockers.push(`Target Node 24 required; actual ${process.versions.node}`);
  if (!existsSync('pnpm-lock.yaml')) blockers.push('No real pnpm lockfile: resolve/admit dependencies before target qualification');
  const pkg=JSON.parse(readFileSync('package.json','utf8'));
  for (const [name,version] of Object.entries({...pkg.dependencies,...pkg.devDependencies})) {
    const path=`node_modules/${name}/package.json`;
    if (!existsSync(path)) { blockers.push(`Not installed: ${name}@${version}`); continue; }
    const actual=JSON.parse(readFileSync(path,'utf8')).version;
    if(actual!==version) blockers.push(`Dependency mismatch: ${name} expected ${version} actual ${actual}`);
  }
  const pnpm=spawnSync('pnpm',['--version'],{encoding:'utf8'});
  if (pnpm.status!==0 || pnpm.stdout.trim()!==pkg.packageManager.split('@').at(-1)) blockers.push('Admitted pnpm version not available');
  if (real) {
    const required=['ZOEN_AUTHORITY_DATABASE_URL','ZOEN_DOOR_DATABASE_URL','ZOEN_OUTBOX_DATABASE_URL','ZOEN_MIGRATOR_DATABASE_URL','BETTER_AUTH_SECRET','ZOEN_EVIDENCE_BUCKET','ZOEN_BUCKET_OWNER','AWS_REGION','ZOEN_PUBLIC_ORIGIN','ZOEN_PORT'];
    for(const key of required) if(!process.env[key]) blockers.push(`Missing ${key}`);
    if(process.env.ZOEN_REAL_TEST_CONSENT!=='disposable-resources-only') blockers.push('Explicit disposable-resource test consent missing');
    for(const key of ['ZOEN_AUTHORITY_DATABASE_URL','ZOEN_DOOR_DATABASE_URL','ZOEN_OUTBOX_DATABASE_URL','ZOEN_MIGRATOR_DATABASE_URL']) if(process.env[key]) {
      try { if(!/^\/zoen_test_[a-z0-9_]+$/.test(new URL(process.env[key]).pathname)) blockers.push(`${key} must target a dedicated zoen_test_* database`); } catch { blockers.push(`${key} is malformed`); }
    }
    if(process.env.ZOEN_EVIDENCE_BUCKET && !process.env.ZOEN_EVIDENCE_BUCKET.startsWith('zoen-test-')) blockers.push('Real tests require a dedicated zoen-test-* AWS S3 bucket');
    if(!existsSync('dist/apps/edge/src/app.js')) blockers.push('Target application build missing');
  }
  return { status: blockers.length?'blocked':'ready-to-attempt', blockers, productionQualified:false };
}
if(process.argv[1]?.endsWith('/preflight.mjs')) { const r=preflight({real:process.argv.includes('--real')}); console.log(JSON.stringify(r,null,2)); if(r.blockers.length)process.exitCode=2; }
