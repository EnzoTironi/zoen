import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
export function files(root) { const output=[]; for(const entry of readdirSync(root,{withFileTypes:true})) {const path=join(root,entry.name);if(entry.isSymbolicLink())throw new Error('Symlink not allowed in source scan');if(entry.isDirectory())output.push(...files(path));else if(entry.isFile())output.push(path);}return output.sort(); }
export const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
export function hashes(paths) {return Object.fromEntries(paths.map(p=>[p.replaceAll('\\','/'),sha256(readFileSync(p))]));}
