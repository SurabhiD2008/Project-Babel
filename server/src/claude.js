/* One hardened path for every Claude call: a hard timeout, explicit handling of
   HTTP errors, refusals and empty or malformed output, a logged outcome, and no
   prompt text in the logs. Callers always get either parsed JSON or null, and
   treat null as "use the offline engine". */

const MESSAGES_URL = "https://api.anthropic.com/v1/messages";
const API_VERSION = "2023-06-01";

function log(outcome, { model, purpose, started }) {
  console.info(JSON.stringify({ event: "claude_call", purpose, model, outcome, ms: Date.now() - started }));
}

function extractJson(text) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch { return null; }
}

function createClaudeClient({ apiKey, model, fetchImpl = fetch, timeoutMs = 9000 }) {
  if (!apiKey) return null;

  return async function callClaude({ purpose, system, user, maxTokens }) {
    const started = Date.now();
    const meta = { model, purpose, started };
    try {
      const res = await fetchImpl(MESSAGES_URL, {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": API_VERSION },
        body: JSON.stringify({ model, max_tokens: maxTokens, system, messages: [{ role: "user", content: user }] }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!res.ok) { log(`http_${res.status}`, meta); return null; }
      const data = await res.json();
      if (data.stop_reason === "refusal") { log("refusal", meta); return null; }
      if (data.stop_reason === "max_tokens") { log("truncated", meta); return null; }
      const text = (data.content || []).find((b) => b.type === "text")?.text || "";
      const parsed = extractJson(text);
      log(parsed ? "ok" : "malformed", meta);
      return parsed;
    } catch (e) {
      log(e.name === "TimeoutError" || e.name === "AbortError" ? "timeout" : "network_error", meta);
      return null;
    }
  };
}

/* User text goes inside a tag the system prompt marks as data. A closing tag
   inside the text would let it break out, so angle brackets are removed. */
function asData(tag, text) {
  return `<${tag}>\n${String(text).replace(/[<>]/g, "")}\n</${tag}>`;
}

module.exports = { createClaudeClient, asData };
