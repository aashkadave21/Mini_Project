import dotenv from "dotenv";
import path from "node:path";
import fs from "node:fs";
import { postgresAdapter } from "./postgres.adapter.js";
import { seedDatabase } from "./seed.js";
import { db } from "./db.js";

dotenv.config();

async function runMigrationCli() {
  console.log("==================================================================");
  console.log("  SDREP Supabase PostgreSQL Migration & Verification Engine");
  console.log("==================================================================");

  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl) {
    console.error("\n[Error] No DATABASE_URL found in environment.");
    console.error("Please add your Supabase connection string to .env:");
    console.error("DATABASE_URL=postgresql://postgres:[PASSWORD]@[HOST]:[PORT]/postgres\n");
    process.exit(1);
  }

  console.log("\n[Step 1/4] Establishing secure SSL handshake with PostgreSQL...");
  try {
    const conn = await postgresAdapter.connect(rawUrl);
    console.log(`[Success] Connected to: ${conn.sanitizedUrl}`);
    console.log(`[Success] Database server time: ${conn.serverTime}`);
  } catch (err: any) {
    console.error(`\n[Connection Failed] ${err.message}`);
    console.error("\n[Troubleshooting Guide]");
    console.error("1. Check that your Supabase password does not contain typographical errors.");
    console.error("2. If your network does not support direct IPv6 (common on some ISPs):");
    console.error("   Switch to the Supabase Session Pooler connection string in your Supabase dashboard:");
    console.error("   Settings -> Database -> Connection String -> Mode: Session (port 5432) or Transaction (port 6543)");
    process.exit(1);
  }

  console.log("\n[Step 2/4] Executing relational schema migrations (DDL)...");
  try {
    const migrationRes = await postgresAdapter.executeMigrations();
    console.log(`[Success] Relational schema applied successfully.`);
    console.log(`[Success] Verified ${migrationRes.appliedTables.length} public tables in PostgreSQL schema:`);
    console.log(`          ${migrationRes.appliedTables.join(", ")}`);
  } catch (err: any) {
    console.error(`\n[Migration Failed] Could not execute schema.sql: ${err.message}`);
    process.exit(1);
  }

  console.log("\n[Step 3/4] Inspecting existing records in Supabase...");
  const hasData = await postgresAdapter.checkHasData();

  if (hasData) {
    console.log("[Notice] Supabase PostgreSQL already contains application records.");
    console.log("[Notice] Skipping initial dataset copy to preserve remote state without overwriting.");
  } else {
    console.log("[Notice] Supabase database is empty. Preparing safe initial migration from local store...");
    // Ensure local database state is populated
    if (!db.state.users || db.state.users.length === 0) {
      await seedDatabase(false);
    }

    const migrationCounts = await postgresAdapter.migrateLocalState(db.state);
    console.log("[Success] Successfully migrated local records into Supabase PostgreSQL:");
    for (const [entity, count] of Object.entries(migrationCounts.insertedCounts)) {
      console.log(`          - ${entity}: ${count} rows synced`);
    }
  }

  console.log("\n[Step 4/4] Validating two-way data integrity...");
  const loaded = await postgresAdapter.loadState();
  if (loaded && loaded.users.length > 0) {
    console.log(`[Success] Successfully read back ${loaded.users.length} users, ${loaded.shelters.length} shelters, and ${loaded.incidents.length} incidents from Supabase!`);
    console.log("\n==================================================================");
    console.log("  MIGRATION COMPLETE: SDREP is fully synchronized with Supabase!");
    console.log("==================================================================\n");
    process.exit(0);
  } else {
    console.error("[Warning] Verification check returned empty dataset.");
    process.exit(1);
  }
}

runMigrationCli().catch((err) => {
  console.error("[Fatal Error]", err);
  process.exit(1);
});
