import "dotenv/config";

const num = (v: string | undefined, d: number) => (v && !Number.isNaN(+v) ? +v : d);

export const settings = {
  databaseUrl: process.env.DATABASE_URL ?? "postgres://orange:orange@localhost:5433/orange_signal",
  /**
   * Model access goes through an OpenAI-compatible gateway, so any provider
   * AgentRouter fronts - Anthropic, OpenAI, DeepSeek, a local Ollama - works
   * by changing the base URL and model string alone.
   *
   * These are only the fallback. The values saved from Settings -> Model in the
   * dashboard take precedence; see src/llm/config.ts.
   */
  llmBaseUrl: process.env.LLM_BASE_URL ?? "https://agentrouter.org/v1",
  llmApiKey: process.env.LLM_API_KEY ?? process.env.AGENTROUTER_API_KEY ?? "",
  /** Signal evaluation is judgement work over long evidence, so it defaults to a strong model. */
  signalModel: process.env.SIGNAL_MODEL ?? "claude-opus-5",
  userAgent: process.env.CRAWLER_USER_AGENT ?? "OrangeSignalBot/0.1 (+mailto:change-me@example.com)",
  concurrency: num(process.env.CRAWLER_CONCURRENCY, 4),
  perHostDelayMs: num(process.env.CRAWLER_DELAY_MS, 1200),
  respectRobots: (process.env.RESPECT_ROBOTS ?? "true") !== "false",
  /**
   * How much evidence text one evaluation call may carry, in characters.
   *
   * Roughly four characters to the token, so the 240k default is about 60k
   * tokens - fine for a frontier model with a large context window, far too
   * much for a rate-limited tier. Groq's free tier, for instance, allows 8k
   * tokens per minute, which means a budget nearer 24k characters.
   */
  evidenceCharBudget: num(process.env.EVIDENCE_CHAR_BUDGET, 240_000),
  newsApiKey: process.env.NEWSAPI_KEY ?? "",
  crunchbaseKey: process.env.CRUNCHBASE_API_KEY ?? "",
  apiPort: num(process.env.API_PORT, 8080),
} as const;
