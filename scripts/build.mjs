import * as esbuild from 'esbuild';

await esbuild.build({
  entryPoints: ['src/app.ts'],
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  outfile: 'dist/app.js',
  packages: 'external',
  logLevel: 'info',
});

console.log('build ok: dist/app.js');
