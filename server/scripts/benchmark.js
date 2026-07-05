/* Honest accuracy/latency benchmark for Name My Feeling (spec §12).
   Runs 50 hand-written feeling descriptions — each written for a specific
   emotion category — against the live /api/feelings/search endpoint and
   measures: (1) whether the returned word's category matches the intended
   category, as a proxy for "semantic fit", and (2) response latency.
   Writes results/metrics.json, which the site's About page reads from. */
const fs = require("fs");
const path = require("path");

const BASE = process.env.BABEL_API || "http://localhost:4600/api";

// 50 inputs, ~7 per category, written independently of the word database
// (not copied from any word's own definition) so matching isn't trivial.
const CASES = [
  // longing
  { text: "I keep aching for a home I don't think I've ever actually lived in.", cat: "longing" },
  { text: "Missing someone so much it feels like a physical weight in my chest.", cat: "longing" },
  { text: "That specific homesickness for my grandmother's kitchen, which doesn't exist anymore.", cat: "longing" },
  { text: "Wishing I could go back to a summer that already ended years ago.", cat: "longing" },
  { text: "The quiet grief of a friendship that faded without any single ending.", cat: "longing" },
  { text: "Longing for a country I emigrated from as a child and barely remember.", cat: "longing" },
  { text: "An ache for a person who is still alive but no longer part of my life.", cat: "longing" },
  // awe
  { text: "Standing at the edge of a canyon and feeling impossibly small and amazed.", cat: "awe" },
  { text: "The hush that comes over a forest right before it starts snowing.", cat: "awe" },
  { text: "Watching the tide come in at dusk and losing all sense of time.", cat: "awe" },
  { text: "The overwhelming scale of a night sky far from any city lights.", cat: "awe" },
  { text: "Sunlight breaking through storm clouds over the ocean, and just staring.", cat: "awe" },
  { text: "The stillness of an old cathedral that makes you want to whisper.", cat: "awe" },
  { text: "Watching a thunderstorm roll in across open farmland, half scared and half thrilled.", cat: "awe" },
  // social
  { text: "That awkward pause where two people both want to apologize first.", cat: "social" },
  { text: "The warm relief of being fully understood by an old friend without explaining.", cat: "social" },
  { text: "Feeling like an outsider at a party where everyone else already knows each other.", cat: "social" },
  { text: "The tension of waiting to see if someone will introduce themselves first.", cat: "social" },
  { text: "A shared glance across a room that says more than any conversation could.", cat: "social" },
  { text: "The specific discomfort of a group photo where nobody knows where to stand.", cat: "social" },
  { text: "Being welcomed into a family gathering as if you'd always belonged there.", cat: "social" },
  // joy
  { text: "The giddy, fluttery feeling right when you realize you might be falling in love.", cat: "joy" },
  { text: "Curling up under a blanket with tea while it storms outside, utterly content.", cat: "joy" },
  { text: "The uncontainable urge to squeeze a baby's cheeks because they're unbearably cute.", cat: "joy" },
  { text: "Pure delight at a surprise reunion with someone you haven't seen in years.", cat: "joy" },
  { text: "The cozy, sociable warmth of a long dinner with people you love.", cat: "joy" },
  { text: "Bursting with proud, gushing happiness over a friend's achievement.", cat: "joy" },
  { text: "That warm, silly happiness of an inside joke shared with someone close.", cat: "joy" },
  // tension
  { text: "The restless, jittery anxiety before an exam whose result you can't control.", cat: "tension" },
  { text: "Cringing so hard for someone else's public mistake that it feels like your own.", cat: "tension" },
  { text: "A simmering, hard-to-name irritation at everything and nothing in particular.", cat: "tension" },
  { text: "The dread of an inbox you have been avoiding for three days straight.", cat: "tension" },
  { text: "That tight, cornered feeling of being asked to explain something embarrassing on the spot.", cat: "tension" },
  { text: "A jittery restlessness the night before a big trip, unable to sit still.", cat: "tension" },
  { text: "The exhausted, wound-up feeling of having had absolutely enough of everything today.", cat: "tension" },
  // time
  { text: "The strange comfort of finding a photo that brings a whole year rushing back.", cat: "time" },
  { text: "Staring blankly into space, thinking of nothing at all for a while.", cat: "time" },
  { text: "The guilty pile of books I keep buying and never actually reading.", cat: "time" },
  { text: "That eerie feeling of a place looking exactly the same after a decade away.", cat: "time" },
  { text: "The specific melancholy of packing away decorations after a holiday ends.", cat: "time" },
  { text: "Noticing the first cold wind of autumn and feeling the whole year turn.", cat: "time" },
  { text: "The bittersweet ache of a song that instantly returns you to your teenage bedroom.", cat: "time" },
  // philosophical
  { text: "Wondering whether the words we have shape which feelings we're able to notice.", cat: "philos" },
  { text: "A quiet late-night question about whether anything you do actually matters.", cat: "philos" },
  { text: "The unsettled sense that the world is arranged in a way that's fundamentally out of balance.", cat: "philos" },
  { text: "Finding a strange, calm acceptance in realizing you can't control the outcome.", cat: "philos" },
  { text: "The small daily sense of purpose that gets you out of bed for no dramatic reason.", cat: "philos" },
  { text: "A gentle wonder at how imperfection can somehow make something more beautiful.", cat: "philos" },
  { text: "Sensing that some things are only truly understood by living through them yourself.", cat: "philos" },
  { text: "A calm, settled feeling that things are exactly as they should be, at least for now.", cat: "philos" },
];

async function run() {
  console.log(`Benchmarking ${CASES.length} inputs against ${BASE}/feelings/search …`);
  let hits = 0;
  const timings = [];
  const rows = [];

  for (const c of CASES) {
    const t0 = Date.now();
    const res = await fetch(`${BASE}/feelings/search`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ input: c.text }),
    });
    const data = await res.json();
    const ms = Date.now() - t0;
    timings.push(ms);
    const matched = data.bestMatch?.category === c.cat;
    if (matched) hits++;
    rows.push({ input: c.text, intendedCategory: c.cat, matchedWord: data.bestMatch?.word, matchedCategory: data.bestMatch?.category, matchScore: data.matchScore, correct: matched, ms });
  }

  const matchRate = Math.round((hits / CASES.length) * 1000) / 10;
  const avgMs = Math.round(timings.reduce((a, b) => a + b, 0) / timings.length);
  const avgScore = Math.round(rows.reduce((a, r) => a + (r.matchScore || 0), 0) / rows.length);

  const summary = {
    generatedAt: new Date().toISOString(),
    sampleSize: CASES.length,
    categoryMatchRate: matchRate,
    avgMatchScore: avgScore,
    avgResponseMs: avgMs,
    minResponseMs: Math.min(...timings),
    maxResponseMs: Math.max(...timings),
    methodology: "50 hand-written feeling descriptions (7 per emotion category), each independently authored (not copied from any word's own definition). 'Category match' = the returned best-match word's category equals the category the input was written for — used as a reproducible proxy for semantic fit, run against the offline matching engine.",
    rows,
  };

  const outDir = path.resolve(__dirname, "../results");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "metrics.json"), JSON.stringify(summary, null, 2));

  console.log(`\nCategory match rate: ${matchRate}% (${hits}/${CASES.length})`);
  console.log(`Average match score: ${avgScore}%`);
  console.log(`Average response time: ${avgMs}ms (min ${Math.min(...timings)}ms, max ${Math.max(...timings)}ms)`);
  console.log(`\nMisses:`);
  rows.filter((r) => !r.correct).forEach((r) => console.log(`  "${r.input.slice(0, 60)}…" -> ${r.matchedWord} (${r.matchedCategory}), expected ${r.intendedCategory}`));
  console.log(`\nWrote results/metrics.json`);
}

run().catch((e) => { console.error(e); process.exit(1); });
