/**
 * Scraper smoke test. Needs no database and no API key.
 *   npx tsx src/cli/smoke.ts celonis.com Celonis
 *
 * Proves the four source adapters against a live site and prints what each returned.
 */
import { detectAts, fetchJobs } from "../sources/ats.js";
import { fetchWebsite } from "../sources/website.js";
import { fetchGdelt, fetchGoogleNews } from "../sources/news.js";
import { resolveFirmographics } from "../sources/firmographics.js";

const domain = process.argv[2] ?? "celonis.com";
const name = process.argv[3] ?? domain.split(".")[0]!;

const preview = (s: string, n = 140) => s.replace(/\s+/g, " ").slice(0, n);

async function main() {
  console.log(`\n### ${name} (${domain})\n`);

  console.log("1. FIRMOGRAPHICS");
  const firm = await resolveFirmographics(name, domain);
  console.log(`   source=${firm.source} country=${firm.country ?? "?"} industry=${firm.industry ?? "?"} employees=${firm.employee_count ?? "?"} founded=${firm.founded_year ?? "?"}`);

  console.log("\n2. ATS DETECTION + JOBS");
  const { handle, careersUrl } = await detectAts(domain, name);
  if (handle) {
    console.log(`   detected: ${handle.provider} slug=${handle.slug} (found at ${careersUrl})`);
    const jobs = await fetchJobs(handle, 10);
    console.log(`   ${jobs.length} postings fetched`);
    for (const j of jobs.slice(0, 5)) {
      console.log(`     - ${j.title}  [${j.publishedAt?.toISOString().slice(0, 10) ?? "no date"}]  ${j.content.length} chars`);
    }
  } else {
    console.log(`   no ATS detected (careers page: ${careersUrl ?? "none"})`);
  }

  console.log("\n3. WEBSITE (sitemap-driven)");
  const pages = await fetchWebsite(domain, 6);
  console.log(`   ${pages.length} pages extracted`);
  for (const p of pages.slice(0, 5)) {
    console.log(`     - ${preview(p.title ?? "", 70)}  [${p.publishedAt?.toISOString().slice(0, 10) ?? "no date"}]  ${p.content.length} chars`);
    console.log(`       ${p.url}`);
  }

  console.log("\n4. NEWS");
  const gdelt = await fetchGdelt(name, { maxArticles: 4, fetchBodies: true });
  console.log(`   GDELT: ${gdelt.length} articles`);
  for (const a of gdelt.slice(0, 4)) {
    console.log(`     - ${preview(a.title ?? "", 80)} [${a.meta?.outlet}] ${a.content.length} chars${a.meta?.headlineOnly ? " (headline only)" : ""}`);
  }
  const gnews = await fetchGoogleNews(name, { maxArticles: 5 });
  console.log(`   Google News: ${gnews.length} headlines`);
  for (const a of gnews.slice(0, 4)) console.log(`     - ${preview(a.title ?? "", 80)}`);

  const total = (handle ? 1 : 0) + pages.length + gdelt.length + gnews.length;
  console.log(`\n   TOTAL evidence items available: ${pages.length + gdelt.length + gnews.length} documents\n`);
  if (total === 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
