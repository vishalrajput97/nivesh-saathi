// Copies the engine and the returns data into public/ so the browser can use them.
// Run: npm run build (Netlify runs this on every deploy).
import { cp, mkdir, rm } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
await rm(new URL('public/engine', root), { recursive: true, force: true });
await rm(new URL('public/data', root), { recursive: true, force: true });
await mkdir(new URL('public/data', root), { recursive: true });
await cp(new URL('src/engine', root), new URL('public/engine', root), { recursive: true });
await cp(new URL('data/returns-data.json', root), new URL('public/data/returns-data.json', root));
console.log('Copied engine and data into public/');
