import dotenv from "dotenv";
import { postgresAdapter } from "../server/src/db/postgres.adapter.js";
import { db } from "../server/src/db/db.js";

dotenv.config();

async function verifySupabaseLive() {
  console.log("==================================================================");
  console.log("  SDREP LIVE SUPABASE POSTGRESQL VERIFICATION SUITE");
  console.log("==================================================================");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${testName} ${detail ? `-> ${detail}` : ""}`);
      failed++;
    }
  }

  // 1. Connection check
  const initRes = await db.init();
  assert(db.backendEngine === "PostgreSQL", `Database Engine: ${db.backendEngine} matches PostgreSQL`);
  assert(db.isConnected === true, "Database Status: Connected to Supabase");

  // 2. Query Supabase directly
  const loadedState = await postgresAdapter.loadState();
  assert(loadedState !== null, "Supabase Query: Successfully queried remote database state");
  assert((loadedState?.users.length || 0) >= 5, `Supabase Data: Found ${loadedState?.users.length} users in PostgreSQL table`);
  assert((loadedState?.shelters.length || 0) >= 5, `Supabase Data: Found ${loadedState?.shelters.length} shelters in PostgreSQL table`);

  // 3. Write data through transaction and verify read back from Supabase
  const testIncidentId = `INC-SUPABASE-${Date.now()}`;
  console.log(`\n  Writing live incident (${testIncidentId}) through backend transaction...`);
  
  await db.withTransaction(async (state) => {
    state.incidents.push({
      id: testIncidentId,
      title: "Live Supabase Connectivity Verification Test",
      type: "flood",
      severity: "info",
      sector: "Sector 7 · Test Grid",
      reported: "12:00",
      victims: 0,
      status: "unassigned",
      pos: [19.088, 72.874],
      description: "Automated end-to-end verification record for Supabase PostgreSQL integration.",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  });

  // Wait 1.5s for transaction sync to complete
  await new Promise((resolve) => setTimeout(resolve, 1500));

  // 4. Query directly from PostgreSQL to verify persistence in Supabase
  const refreshedState = await postgresAdapter.loadState();
  const remoteIncident = refreshedState?.incidents.find((i) => i.id === testIncidentId);
  assert(remoteIncident !== undefined, `Persistence: Live incident ${testIncidentId} successfully queried back from Supabase`);
  assert(remoteIncident?.title === "Live Supabase Connectivity Verification Test", "Integrity: Column values match exactly in PostgreSQL");

  // Clean up test incident in state
  const idx = db.state.incidents.findIndex((i) => i.id === testIncidentId);
  if (idx !== -1) {
    db.state.incidents.splice(idx, 1);
    db.saveToFile();
  }

  console.log("\n==================================================================");
  console.log(`  VERIFICATION RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log("==================================================================\n");

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

verifySupabaseLive().catch((err) => {
  console.error("[Fatal Error in live verification]", err);
  process.exit(1);
});
