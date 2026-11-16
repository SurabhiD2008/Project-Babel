/* Offline, word-level check of the matching engine — no server or database.

     node scripts/engine-check.js            summary
     node scripts/engine-check.js -v         also list every miss
     node scripts/engine-check.js "a feeling described in plain words"   explain one query

   benchmark.js measures whether the *category* of the returned word matches.
   This asks the harder question: did Name My Feeling return the right *word*?
   Each case is a plain-language description (not copied from a definition)
   with the set of words that would be a correct answer. TUNE cases were used
   while building the thesaurus; HELD cases were written up front and only ever
   scored, so they show how the engine does on phrasing it wasn't shaped around. */
const fs = require("fs");
const path = require("path");

const sandbox = {};
new Function("window", fs.readFileSync(path.resolve(__dirname, "../../web/src/data/data.js"), "utf8"))(sandbox);
const WORDS = sandbox.BABEL.WORDS;
const AI = require("../src/ai.js");

const TUNE = [
  ["the ache of missing a place I've never actually been to", "kaukokaipuu fernweh hiraeth saudade sehnsuchtsort"],
  ["that look between two people who both want to speak first", "mamihlapinatapai"],
  ["sunlight coming through the leaves on a slow afternoon", "komorebi"],
  ["feeling like an outsider at a party where everyone knows each other", "aduantas"],
  ["I bought so many books and never read them", "tsundoku"],
  ["cringing because someone else is embarrassing themselves", "fremdschamen vergueenza myotahapea"],
  ["happy for my friend who got promoted, no jealousy at all", "firgun gonnen gunnen mudita kvell"],
  ["thinking of the perfect comeback hours after the argument", "treppenwitz espritescalier"],
  ["the excitement of looking forward to a holiday", "vorfreude voorpret resfeber"],
  ["nervous and excited the night before travelling", "resfeber"],
  ["I want to squeeze my puppy because it's so cute", "gigil"],
  ["a song stuck in my head all day", "ohrwurm"],
  ["staying up late because it's the only time I have to myself", "baofuxing trasnochar"],
  ["cozy evening with candles and friends, feeling warm and safe", "hygge gezelligheid koselig gemutlichkeit mysa zatyshok geborgenheit"],
  ["the smell of rain on dry earth", "petrichor"],
  ["sad that the world is not how it should be", "weltschmerz"],
  ["homesick for my country and my people", "herrimina honvagy morrina cianalas hiraeth xenitia banzo hiraezh"],
  ["I miss you so much it hurts", "hianyzol deltang dor nho saudade ilgesys viraha"],
  ["I feel so angry I could explode", "fuchsteufelswild amuk hwabyung"],
  ["I'm fed up and done with everything", "raslebol fiu khalas"],
  ["bored and empty, nothing interests me", "ennui acedia fiu"],
  ["the urge to jump when standing on a high ledge", "lappel-du-vide"],
  ["moonlight reflecting on the sea", "yakamoz mangata"],
  ["taking a walk in the wind to clear my mind", "uitwaaien"],
  ["lingering at the dinner table talking after eating", "sobremesa natafelen"],
  ["I ate too much because it tasted so good", "shemomedjamo"],
  ["sleepy and satisfied after a huge lunch", "abbiocco uitbuiken"],
  ["accepting that some things can't be changed", "shoganai meibanfa nrimo maalish"],
  ["falling in love for the first time, euphoric", "forelsket kilig coupdefoudre koinoyokan"],
  ["love at first sight", "coupdefoudre koinoyokan"],
  ["the peace of being alone in a forest", "waldeinsamkeit shinrinyoku"],
  ["pleasure at my rival's failure", "schadenfreude gosohada"],
  ["afraid I'm running out of time to do the things I wanted in life", "torschlusspanik"],
  ["beauty in broken, imperfect, old things", "wabisabi kintsugi shibui"],
  ["the sadness of things passing, cherry blossoms falling", "mononoaware hanami"],
  ["waiting for someone and keep checking the window to see if they arrived", "iktsuarpok"],
  ["forgot someone's name when I had to introduce them", "tartle"],
  ["reason to get up in the morning, my purpose", "ikigai"],
  ["doing nothing all afternoon and enjoying it without guilt", "dolcefarniente fjaka keyif meriggiare"],
  ["running my fingers through my lover's hair", "cafune"],
  ["a hug that makes me feel completely safe", "cwtch geborgenheit"],
  ["lonely and longing in an empty place", "uaigneas"],
  ["bittersweet nostalgia for my childhood", "natsukashii tizita saudade nho hiraeth"],
  ["happy and sad at the same time", "charmolypi setsunai"],
  ["pretending not to be home when the doorbell rings", "irusu"],
  ["the first drink outside in the sunshine after winter", "utepils"],
  ["moved to tears by a touching story", "commuovere"],
  ["goosebumps from beautiful music", "frisson tarab duende"],
  ["I don't want to bother or impose on anyone", "grengjai enryo ahnarde sungkan"],
  ["can't decide, torn between two choices", "dodel zugzwang"],
  ["itching to travel the world", "wanderlust fernweh"],
  ["the weight I gained from stress eating after the breakup", "kummerspeck"],
  ["everyone knows the truth but nobody talks about it", "mokita"],
  ["reading the mood of a room without anyone saying anything", "nunchi kuukiwoyomu"],
  ["making things worse while trying to fix them", "verschlimmbessern"],
  ["hangover misery the morning after", "kater gueuledebois sushnyak"],
  ["patience through hard times", "sabr hankuri ntoboase suuru"],
  ["a deep bond with my community, we are all one", "ubuntu simunye uri umunthu botho fihavanana sobornost"],
  ["walking around the city with no destination", "flaner"],
  ["I just feel calm and at peace inside", "sukoon hingerahu ataraxia seijaku sith shwari"],
];

const HELD = [
  ["my kid won the spelling bee and I'm bursting with pride", "naches kvell"],
  ["can't be bothered to do anything today, no energy", "orka acedia innererschweinehund ennui"],
  ["that voice in my head that tells me to skip the gym", "innererschweinehund"],
  ["spending all my money on eating out", "kuidaore"],
  ["messy tangled headphone cables", "kabelsalat"],
  ["daydreaming about impossible plans", "luftschloss somiatruites luftmensch kopfkino"],
  ["wearing my new shoes for the first time", "estrenar"],
  ["it looks sunny outside but it's actually freezing", "gluggavedur"],
  ["dark depressing winter with no sun", "kaamos dreich"],
  ["grey rainy miserable weather", "dreich"],
  ["eating when I'm not hungry just because I'm bored", "kuchisabishii"],
  ["the feeling when someone you love is far away", "viraha dor deltang amordelonh ilgesys saudade hianyzol"],
  ["thirsty after a night of drinking", "sushnyak"],
  ["my friends getting together again after years apart", "rimpatriata retrouvailles aspaldiko"],
  ["afraid to start something new", "schwellenangst"],
  ["ignoring a problem and hoping it goes away", "struisvogelpolitiek"],
  ["he has a really punchable face", "backpfeifengesicht"],
  ["the silence in an empty church", "ciunas seijaku sith"],
  ["sitting quietly watching the snow fall, totally still", "seijaku ciunas sith boketto dadirri"],
  ["a secret spot only I know where I go to relax", "smultronstalle querencia"],
  ["being stuck with only bad options", "zugzwang"],
  ["I laughed at a joke because it was so bad", "jayus"],
  ["the afterglow after a concert ends", "yoin"],
  ["I gave my wife flowers to say sorry after the fight", "drachenfutter"],
  ["feeling protective tenderness and pity toward someone", "thuong anet hniena karuna"],
  ["longing for something but I don't know what", "sehnsucht toska hrepenenje"],
  ["homesickness for a home that no longer exists", "hiraeth hiraezh saudade"],
  ["stubbornly doing something just because people told me not to", "inat davka"],
  ["glad to finally be done with work for the day", "feierabend"],
  ["having the whole house to myself while my parents are away", "sturmfrei"],
  ["suddenly realising how miserable my own life is", "litost"],
  ["a gut feeling for the right thing to say in a delicate situation", "fingerspitzengefuhl"],
  ["anxious restless can't sit still", "shpilkes"],
  ["the joy of working, I love my job", "arbejdsglaede meraki"],
  ["grateful to someone who helped me, I owe them forever", "utangnaloob"],
  ["I feel like I don't belong anywhere, a stranger in a foreign country", "aduantas depaysement xenitia"],
  ["watching the sunset and feeling how small I am in the universe", "yugen"],
  ["sulking at my boyfriend so he'll pay attention to me", "tampo oodal abhiman nakhra sajiao"],
  ["the kindness of strangers who welcomed me into their home", "philoxenia teranga melmastia someah manaakitanga qonaqjaylylyq flaithiulacht"],
  ["living slowly, not rushing", "moramora mananana jamkaret"],
];

// The 50 category cases from benchmark.js, scored here without the HTTP round trip.
const CATEGORY_CASES = new Function(
  fs.readFileSync(path.resolve(__dirname, "benchmark.js"), "utf8").match(/const CASES = \[[\s\S]*?\n\];/)[0] + "; return CASES;"
)();

const args = process.argv.slice(2);
const verbose = args.includes("-v");
const queries = args.filter((a) => a !== "-v");

if (queries.length) {
  for (const q of queries) {
    const r = AI.localFeelingSearch(q, WORDS);
    console.log(`\n"${q}"\n  ${r.matchScore}%  ${r.bestMatch.word} (${r.bestMatch.language}) — ${r.bestMatch.defShort}`);
    r.alternates.forEach((a) => console.log(`  ${a.match}%  ${a.word} (${a.lang})`));
  }
  process.exit(0);
}

function run(name, set) {
  let top1 = 0, top5 = 0;
  for (const [q, ok] of set) {
    const accept = new Set(ok.split(" "));
    const r = AI.localFeelingSearch(q, WORDS);
    const got = [r.bestMatch.slug, ...r.alternates.map((a) => a.slug)];
    const first = accept.has(got[0]), any = got.some((g) => accept.has(g));
    top1 += first; top5 += any;
    if (verbose && !first) console.log(`  ${any ? "~" : "x"} ${q}\n      → ${got.join(", ")}`);
  }
  const pct = (n) => Math.round((n / set.length) * 100);
  console.log(`${name}: best match correct ${top1}/${set.length} (${pct(top1)}%) · correct word among the five shown ${top5}/${set.length} (${pct(top5)}%)`);
}

run("Tuning set  ", TUNE);
run("Held-out set", HELD);
let hits = 0;
for (const c of CATEGORY_CASES) {
  const r = AI.localFeelingSearch(c.text, WORDS);
  const ok = r.bestMatch.category === c.cat;
  hits += ok;
  if (verbose && !ok) console.log(`  x [${c.cat}] ${c.text}\n      → ${r.bestMatch.word} [${r.bestMatch.category}]`);
}
console.log(`Category benchmark (benchmark.js cases): ${hits}/${CATEGORY_CASES.length} (${Math.round((hits / CATEGORY_CASES.length) * 100)}%)`);
