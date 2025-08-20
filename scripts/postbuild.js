#!/usr/bin/env node

// NPM postbuild hook - creates Heroku entry point after build
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.dirname(__dirname);

console.log('📦 Post-build: Creating Heroku entry point...');

try {
  const entryPoint = path.join(projectRoot, 'dist', 'index.js');
  const entryContent = '// Heroku entry point\nimport "./server/index.js";';
  
  // Ensure dist directory exists
  const distDir = path.dirname(entryPoint);
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }
  
  fs.writeFileSync(entryPoint, entryContent);
  console.log('✅ Created Heroku entry point at dist/index.js');
  
} catch (error) {
  console.error('❌ Failed to create entry point:', error.message);
  process.exit(1);
}