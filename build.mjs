import { build } from 'esbuild';
import { cpSync, mkdirSync, existsSync, readdirSync, statSync } from 'fs';

// Build renderer (React app)
await build({
  entryPoints: ['src/renderer/src/app.tsx'],
  bundle: true,
  outfile: 'dist/renderer/bundle.js',
  format: 'iife',
  target: 'chrome120',
  platform: 'browser',
  loader: {
    '.tsx': 'tsx',
    '.ts': 'ts',
    '.css': 'css',
  },
  define: {
    'process.env.NODE_ENV': '"production"',
  },
  minify: false,
  sourcemap: false,
});

// Copy HTML
cpSync('src/renderer/index.html', 'dist/renderer/index.html');

// Copy default icons
function copyDirSync(src, dest) {
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src)) {
    const srcPath = `${src}/${entry}`;
    const destPath = `${dest}/${entry}`;
    if (statSync(srcPath).isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      cpSync(srcPath, destPath);
    }
  }
}
if (existsSync('default-icons')) {
  copyDirSync('default-icons', 'dist/default-icons');
}

console.log('Build complete!');
