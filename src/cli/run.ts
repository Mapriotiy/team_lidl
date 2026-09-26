/**
 * Pipeline CLI.
 *   npm run db:init                      create the schema
 *   npm run seed                         load services, signal questions and ICP from config/seed.json
 *   npm run ingest -- --file config/targets.json
 *   npm run ingest -- "Company Name" company.com
 *   npm run evaluate -- --service apa
 *   npm run score -- --service apa
 *   npm run pipeline -- --file config/targets.json --service apa
 *   npx tsx src/cli/run.ts report --service apa
 */
import { readFileSync } from "node:fs";
import { q, one, initSchema, pool } from "../db.js";
import { ingestCompany } from "../pipeline/ingest.js";
import { evaluateCompanyForService } from "../signals/evaluate.js";
import { scoreCompanyForService } from "../scoring/score.js";
import { settings } from "../settings.js";
import type { Company } from "../types.js";

const argv = process.argv.slice(2);
const command = argv[0] ?? "help";

function flag(name: string): string | undefined {
  const i = argv.indexOf("--" + name);
  return i >= 0 ? argv[i + 1] : undefined;
}

const positionals = argv.slice(1).filter((a, i, arr) => !a.startsWith("--") && !(arr[i - 1] ?? "").startsWith("--"));

async function servicesToRun(): Promise<Array<{ id: string; key: string; name: string }>> {
  const key = flag("service");
  return key
    ? await q(`SELECT id, key, name FROM services WHERE key=$1`, [key])
    : await q(`SELECT id, key, name FROM services WHERE active ORDER BY name`);
}

async function seed(): Promise<void> {
  const config = JSON.parse(readFileSync(flag("config") ?? "config/seed.json", "utf8"));
  for (const svc of config.services) {
    const service = await one<{ id: string }>(
      `INSERT INTO services (key, name, description, value_prop) VALUES ($1,$2,$3,$4)
       ON CONFLICT (key) DO UPDATE SET name=EXCLUDED.name, description=EXCLUDED.description, value_prop=EXCLUDED.value_prop
       RETURNING id`,
      [svc.key, svc.name, svc.description ?? null, svc.value_prop ?? null],
    );
    for (const qq of svc.questions ?? []) {
      await q(
        `INSERT INTO signal_questions (service_id, key, text, weight, polarity, source_kinds, half_life_days)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (service_id, key) DO UPDATE SET text=EXCLUDED.text, weight=EXCLUDED.weight,
           polarity=EXCLUDED.polarity, source_kinds=EXCLUDED.source_kinds, half_life_days=EXCLUDED.half_life_days`,
        [service!.id, qq.key, qq.text, qq.weight, qq.polarity, qq.source_kinds, qq.half_life_days ?? 180],
      );
    }
    if (svc.icp) {
      await q(`DELETE FROM icp_profiles WHERE service_id=$1`, [service!.id]);
      await q(
        `INSERT INTO icp_profiles (service_id, name, countries, industries, min_employees, max_employees, exclude_industries, fit_weight)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [service!.id, svc.icp.name, svc.icp.countries ?? [], svc.icp.industries ?? [], svc.icp.min_employees ?? null,
         svc.icp.max_employees ?? null, svc.icp.exclude_industries ?? [], svc.icp.fit_weight ?? 0.3],
      );
    }
    console.log(`seeded ${svc.name}: ${svc.questions?.length ?? 0} signal questions`);
  }
}

async function targets(): Promise<Array<{ name: string; domain: string }>> {
  const file = flag("file");
  if (file) return JSON.parse(readFileSync(file, "utf8"));
  const [name, domain] = positionals;
  if (name && domain) return [{ name, domain }];
  const rows = await q<{ name: string; domain: string }>(`SELECT name, domain FROM companies ORDER BY name`);
  if (!rows.length) throw new Error('nothing to ingest: pass --file config/targets.json or "Name" domain.com');
  return rows;
}

/**
 * The key may come from the database (saved in the dashboard) or the
 * environment, so this asks the resolver rather than checking one env var.
 */
async function requireKey(): Promise<void> {
  const { loadLlmConfig } = await import("../llm/config.js");
  const config = await loadLlmConfig();
  if (!config.apiKey) {
    throw new Error(
      "No model API key configured - set it under Settings -> Model in the dashboard, " +
        "or set LLM_API_KEY in .env (copy .env.example to start)",
    );
  }
  console.log(`using ${config.model} via ${config.baseUrl} (key from ${config.keySource})`);
}

async function main(): Promise<void> {
  switch (command) {
    case "init": {
      await initSchema();
      console.log("schema created");
      break;
    }
    case "seed": {
      await seed();
      break;
    }
    case "ingest": {
      for (const t of await targets()) await ingestCompany(t.name, t.domain);
      break;
    }
    case "evaluate": {
      await requireKey();
      const companies = await q<Company>(`SELECT * FROM companies ORDER BY name`);
      const budget = flag("budget") ? Number(flag("budget")) : undefined;
      for (const service of await servicesToRun()) {
        console.log(`\n--- evaluating ${service.name} ---`);
        for (const c of companies) {
          try {
            await evaluateCompanyForService(c, service.id, budget);
          } catch (err) {
            console.error(`  ${c.name}: ${(err as Error).message}`);
          }
        }
      }
      break;
    }
    case "score": {
      const companies = await q<Company>(`SELECT * FROM companies ORDER BY name`);
      for (const service of await servicesToRun()) {
        for (const c of companies) await scoreCompanyForService(c, service.id);
        console.log(`scored ${companies.length} companies for ${service.name}`);
      }
      break;
    }
    case "all": {
      await requireKey();
      for (const t of await targets()) await ingestCompany(t.name, t.domain);
      const companies = await q<Company>(`SELECT * FROM companies ORDER BY name`);
      for (const service of await servicesToRun()) {
        console.log(`\n--- ${service.name} ---`);
        for (const c of companies) {
          try {
            await evaluateCompanyForService(c, service.id);
            await scoreCompanyForService(c, service.id);
          } catch (err) {
            console.error(`  ${c.name}: ${(err as Error).message}`);
          }
        }
      }
      await report();
      break;
    }
    case "report": {
      await report();
      break;
    }
    default:
      console.log(readFileSync("src/cli/run.ts", "utf8").split("*/")[0]!.replace(/^\/\*\*?/, ""));
  }
}

async function report(): Promise<void> {
  for (const service of await servicesToRun()) {
    const rows = await q<any>(
      `SELECT c.name, c.country, c.employee_count, ls.total, ls.band, ls.fit_score, ls.intent_score,
              ls.breakdown -> 'top_reasons' AS reasons
         FROM lead_scores ls JOIN companies c ON c.id=ls.company_id
        WHERE ls.service_id=$1 ORDER BY ls.disqualified, ls.total DESC LIMIT 25`,
      [service.id],
    );
    console.log(`\n===== ${service.name} =====`);
    for (const r of rows) {
      console.log(`${String(r.total).padStart(6)}  ${r.band.padEnd(12)} ${r.name} (${r.country ?? "?"}, ${r.employee_count ?? "?"} staff)  fit ${r.fit_score} / intent ${r.intent_score}`);
      for (const reason of (r.reasons ?? []).slice(0, 2)) console.log(`          - ${reason}`);
    }
  }
}

main()
  .catch((err) => {
    console.error("\n" + (err as Error).message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
