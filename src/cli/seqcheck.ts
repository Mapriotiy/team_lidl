/**
 * Report (and optionally repair) identity sequences that have fallen behind
 * their table's max(id).
 *
 * A sequence lands behind when rows arrive with explicit ids - a dump restore,
 * a manual seed - because that path never advances the generator. The next
 * plain INSERT then reuses a live id and fails on the primary key, which is how
 * a crawl dies partway through a target list.
 *
 *   npx tsx src/cli/seqcheck.ts        report only
 *   npx tsx src/cli/seqcheck.ts --fix  resync the ones that are behind
 */
import { q, pool } from "../db.js";

const fix = process.argv.includes("--fix");

interface Row {
  table_name: string;
  column_name: string;
  sequence: string;
}

const owned = await q<Row>(`
  SELECT c.table_name, c.column_name,
         pg_get_serial_sequence(c.table_name, c.column_name) AS sequence
    FROM information_schema.columns c
   WHERE c.table_schema = 'public'
     AND pg_get_serial_sequence(c.table_name, c.column_name) IS NOT NULL
   ORDER BY c.table_name`);

let behind = 0;

for (const row of owned) {
  const [table] = await q<{ max_id: string }>(
    `SELECT coalesce(max(${row.column_name}), 0)::bigint AS max_id FROM ${row.table_name}`,
  );
  const [state] = await q<{ last_value: string; is_called: boolean }>(
    `SELECT last_value, is_called FROM ${row.sequence}`,
  );
  if (!table || !state) continue;

  // The next value the generator will hand out.
  const next = state.is_called ? BigInt(state.last_value) + 1n : BigInt(state.last_value);
  const highest = BigInt(table.max_id);
  const stale = next <= highest;

  if (stale) {
    behind++;
    console.log(`BEHIND  ${row.table_name}.${row.column_name}  max=${highest} next=${next}`);
    if (fix) {
      await q(`SELECT setval($1, $2, true)`, [row.sequence, String(highest)]);
      console.log(`        resynced to ${highest}`);
    }
  } else {
    console.log(`ok      ${row.table_name}.${row.column_name}  max=${highest} next=${next}`);
  }
}

console.log(
  behind === 0
    ? "\nEvery sequence is ahead of its table."
    : fix
      ? `\nResynced ${behind} sequence(s).`
      : `\n${behind} sequence(s) behind. Re-run with --fix to resync.`,
);

await pool.end();
