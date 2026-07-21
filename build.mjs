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

// Copy default icons from node_modules
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

const lucideDir = 'node_modules/lucide-static/icons';
const tablerDir = 'node_modules/@tabler/icons/icons/outline';
if (existsSync(lucideDir)) {
  copyDirSync(lucideDir, 'dist/default-icons/lucide');
}
if (existsSync(tablerDir)) {
  copyDirSync(tablerDir, 'dist/default-icons/tabler');
}

console.log('Build complete!');
