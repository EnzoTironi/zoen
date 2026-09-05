import { spawnSync } from 'node:child_process';
import { preflight } from './preflight.mjs';
const core=spawnSync(process.execPath,['tooling/verify-core.mjs'],{stdio:'inherit'});if(core.status!==0)process.exit(core.status??1);
const target=preflight();if(target.blockers.length){console.error(JSON.stringify(target,null,2));process.exit(2);}
const build=spawnSync('pnpm',['build'],{stdio:'inherit'});if(build.status!==0)process.exit(build.status??1);
const real=spawnSync(process.execPath,['tooling/real-tests.mjs'],{stdio:'inherit'});process.exit(real.status??1);
