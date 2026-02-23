#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function success(message) {
  log(`✓ ${message}`, 'green');
}

function error(message) {
  log(`✗ ${message}`, 'red');
}

function warning(message) {
  log(`⚠ ${message}`, 'yellow');
}

function info(message) {
  log(`ℹ ${message}`, 'cyan');
}

function section(title) {
  log(`\n${title}`, 'blue');
  log('='.repeat(50), 'blue');
}

// Check environment file
function checkEnvFile() {
  section('Environment Variables');

  const envPath = path.join(process.cwd(), '.env.local');
  const envExamplePath = path.join(process.cwd(), '.env.local.example');

  if (!fs.existsSync(envPath)) {
    warning('.env.local not found');
    if (fs.existsSync(envExamplePath)) {
      info('Create .env.local from .env.local.example:');
      info('  cp .env.local.example .env.local');
      return false;
    }
  } else {
    success('.env.local file exists');
  }

  // Load environment variables
  const envContent = fs.readFileSync(envPath, 'utf-8');
  const envLines = envContent
    .split('\n')
    .filter((line) => line.trim() && !line.startsWith('#'));

  const requiredVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'ANTHROPIC_API_KEY',
  ];

  const optionalVars = [
    'OPENAI_API_KEY',
    'EMAIL_PROVIDER',
    'NEXT_PUBLIC_APP_URL',
  ];

  const envVars = {};
  envLines.forEach((line) => {
    const [key, ...valueParts] = line.split('=');
    const value = valueParts.join('=').trim();
    envVars[key.trim()] = value;
  });

  let allRequiredSet = true;

  log('\nRequired Variables:', 'cyan');
  requiredVars.forEach((varName) => {
    const value = envVars[varName];
    if (!value || value.includes('your_')) {
      error(`${varName} - not configured`);
      allRequiredSet = false;
    } else {
      success(`${varName} - configured`);
    }
  });

  log('\nOptional Variables:', 'cyan');
  optionalVars.forEach((varName) => {
    const value = envVars[varName];
    if (!value || value.includes('your_')) {
      warning(`${varName} - not configured (optional)`);
    } else {
      success(`${varName} - configured`);
    }
  });

  return allRequiredSet;
}

// Check dependencies
function checkDependencies() {
  section('Dependencies');

  const packageJsonPath = path.join(process.cwd(), 'package.json');

  if (!fs.existsSync(packageJsonPath)) {
    error('package.json not found');
    return false;
  }

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
  const nodeModulesPath = path.join(process.cwd(), 'node_modules');

  if (!fs.existsSync(nodeModulesPath)) {
    warning('node_modules directory not found');
    info('Run: npm install');
    return false;
  }

  success('Dependencies installed (node_modules found)');
  return true;
}

// Check migration files
function checkMigrations() {
  section('Database Migrations');

  const migrationsPath = path.join(
    process.cwd(),
    'supabase',
    'migrations'
  );

  if (!fs.existsSync(migrationsPath)) {
    error('supabase/migrations directory not found');
    return false;
  }

  const migrationFiles = fs
    .readdirSync(migrationsPath)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  if (migrationFiles.length === 0) {
    error('No migration files found');
    return false;
  }

  success(`Migration files found: ${migrationFiles.length}`);
  migrationFiles.forEach((file) => {
    info(`  - ${file}`);
  });

  return true;
}

// Check project structure
function checkProjectStructure() {
  section('Project Structure');

  const requiredDirs = [
    'src',
    'src/app',
    'src/lib',
    'src/components',
    'src/types',
  ];

  let allDirsExist = true;

  requiredDirs.forEach((dir) => {
    const dirPath = path.join(process.cwd(), dir);
    if (fs.existsSync(dirPath)) {
      success(`${dir} directory exists`);
    } else {
      error(`${dir} directory not found`);
      allDirsExist = false;
    }
  });

  return allDirsExist;
}

// Main verification
function main() {
  log(
    '\n╔════════════════════════════════════════════════════╗',
    'cyan'
  );
  log(
    '║  Translation Manager - Setup Verification Script  ║',
    'cyan'
  );
  log(
    '╚════════════════════════════════════════════════════╝\n',
    'cyan'
  );

  const checks = [
    { name: 'Environment Variables', fn: checkEnvFile },
    { name: 'Dependencies', fn: checkDependencies },
    { name: 'Migrations', fn: checkMigrations },
    { name: 'Project Structure', fn: checkProjectStructure },
  ];

  const results = checks.map((check) => ({
    name: check.name,
    passed: check.fn(),
  }));

  section('Summary');

  const allPassed = results.every((r) => r.passed);
  const passedCount = results.filter((r) => r.passed).length;

  results.forEach((result) => {
    if (result.passed) {
      success(`${result.name}`);
    } else {
      error(`${result.name}`);
    }
  });

  log(`\nTotal: ${passedCount}/${results.length} checks passed`, 'cyan');

  if (allPassed) {
    log(
      '\n✓ All checks passed! Ready to start development.',
      'green'
    );
    log('\nNext steps:', 'cyan');
    log('  1. npm run verify       - Verify your setup', 'reset');
    log('  2. npm run dev          - Start development server', 'reset');
    log('  3. Open http://localhost:3000 in your browser', 'reset');
    process.exit(0);
  } else {
    log(
      '\n✗ Some checks failed. Please fix the issues above.',
      'red'
    );
    log('\nFor help, see GETTING_STARTED.md', 'cyan');
    process.exit(1);
  }
}

main();
