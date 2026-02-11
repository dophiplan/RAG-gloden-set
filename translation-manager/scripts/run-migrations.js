#!/usr/bin/env node

/**
 * Run Supabase migrations
 * This script executes SQL migration files against the database
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env.local
const envPath = path.join(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim().replace(/^["']|["']$/g, '');
      process.env[key] = value;
    }
  });
}

// Get database URL from environment
const databaseUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

if (!databaseUrl) {
  console.error('❌ DATABASE_URL or SUPABASE_DB_URL not found in .env.local');
  console.error('Please set one of these environment variables.');
  process.exit(1);
}

// Get migration files to run
const migrationsDir = path.join(__dirname, '../supabase/migrations');
const args = process.argv.slice(2);

let migrationFiles;
if (args.length > 0) {
  // Run specific migrations
  migrationFiles = args.map(arg => {
    const file = path.join(migrationsDir, `${arg}.sql`);
    if (!fs.existsSync(file)) {
      const altFile = path.join(migrationsDir, arg);
      if (!fs.existsSync(altFile)) {
        console.error(`❌ Migration file not found: ${arg}`);
        process.exit(1);
      }
      return altFile;
    }
    return file;
  });
} else {
  // Run all migrations
  migrationFiles = fs.readdirSync(migrationsDir)
    .filter(file => file.endsWith('.sql'))
    .sort()
    .map(file => path.join(migrationsDir, file));
}

console.log('🚀 Running Supabase migrations...\n');

// Run each migration
let successCount = 0;
let errorCount = 0;

for (const file of migrationFiles) {
  const filename = path.basename(file);
  console.log(`📄 Running: ${filename}`);

  try {
    // Execute migration using psql
    const result = execSync(`psql "${databaseUrl}" -f "${file}"`, {
      encoding: 'utf-8',
      stdio: 'pipe',
    });

    console.log(`✅ Success: ${filename}`);
    if (result && result.trim()) {
      console.log(`   Output: ${result.trim().split('\n').slice(0, 3).join('\n   ')}`);
    }
    successCount++;
  } catch (error) {
    console.error(`❌ Failed: ${filename}`);
    console.error(`   Error: ${error.message}`);
    if (error.stderr) {
      console.error(`   Details: ${error.stderr.toString().slice(0, 200)}`);
    }
    errorCount++;
  }

  console.log('');
}

// Summary
console.log('═══════════════════════════════════════');
console.log(`✅ Successful: ${successCount}`);
if (errorCount > 0) {
  console.log(`❌ Failed: ${errorCount}`);
}
console.log('═══════════════════════════════════════\n');

if (errorCount > 0) {
  console.error('⚠️  Some migrations failed. Please check the errors above.');
  process.exit(1);
} else {
  console.log('🎉 All migrations completed successfully!');
}
