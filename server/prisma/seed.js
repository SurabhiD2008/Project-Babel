/* Seed the database from the shared 500-word dataset (site/data.js).
   data.js is a browser script that assigns window.BABEL — we provide a
   window shim so it can be required directly, keeping a single source of truth. */
const path = require("path");
try { process.loadEnvFile(path.resolve(__dirname, "../.env")); } catch { /* .env is optional */ }
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

global.window = {};
require(path.resolve(__dirname, "../../site/data.js"));
const { WORDS } = global.window.BABEL;

const DIM_LABELS = {
  cognitive: "Cognitive Science",
  cultural: "Cultural Origin",
  linguistic: "Linguistic Structure",
  english: "Nearest in English",
  philosophy: "Philosophy",
  art: "Art & Music",
};
const DIM_ORDER = ["cognitive", "cultural", "linguistic", "english", "philosophy", "art"];

async function main() {
  console.log(`Seeding ${WORDS.length} words…`);

  // Clear existing rows (children first for FK safety).
  await prisma.savedWord.deleteMany();
  await prisma.related.deleteMany();
  await prisma.comparison.deleteMany();
  await prisma.culture.deleteMany();
  await prisma.dimension.deleteMany();
  await prisma.word.deleteMany();

  let n = 0;
  for (const w of WORDS) {
    await prisma.word.create({
      data: {
        slug: w.slug,
        number: w.number,
        word: w.word,
        language: w.language,
        native: w.native || "",
        phonetic: w.phonetic || "",
        family: w.family,
        script: w.script,
        distScore: w.dist,
        intensity: w.intensity || 60,
        category: w.category,
        defShort: w.defShort,
        defFull: w.defFull,
        dimensions: {
          create: DIM_ORDER.filter((k) => w.dims && w.dims[k]).map((k) => ({
            label: DIM_LABELS[k],
            content: w.dims[k],
          })),
        },
        cultures: {
          create: (w.cultures || []).map((c) => ({ name: c.name, content: c.content })),
        },
        comparisons: {
          create: (w.comparisons || []).map((c) => ({
            lang: c.lang,
            comparisonWord: c.word,
            similarity: c.sim,
          })),
        },
        related: {
          create: (w.related || []).map((slug) => ({ relatedSlug: slug })),
        },
      },
    });
    if (++n % 100 === 0) console.log(`  …${n} seeded`);
  }

  const counts = {
    words: await prisma.word.count(),
    dimensions: await prisma.dimension.count(),
    cultures: await prisma.culture.count(),
    comparisons: await prisma.comparison.count(),
    related: await prisma.related.count(),
  };
  console.log("Done:", counts);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
