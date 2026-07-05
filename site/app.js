/* ============================================================
   PROJECT BABEL — Application
   Vanilla SPA (hash router). No build step: open index.html.
   Integrates Version 2 (spec §13): mock backend, user accounts,
   word-of-day API, community submissions, trie search,
   recommendation engine, shareable image cards, and the
   cognitive-distance algorithm.
   ============================================================ */
(function(){
"use strict";
const { WORDS, WORDS_BY_SLUG, CATEGORIES, CAT_COLOR, categoryName, categoryCounts, LANGUAGE_FAMILIES, LANGUAGES, HIDDEN, isHidden, VISIBLE_WORDS } = window.BABEL;

const app = document.getElementById("app");
// Canonical public site URL — always https so shared links open securely
// (many browsers now refuse or warn on plain http). Used on the shareable
// image card and in every social-share intent.
const SITE_URL = "https://babel.io";
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => [...root.querySelectorAll(sel)];

/* Match a free-text name (e.g. a comparison word) against a hidden word so we
   can keep hidden words out of other words' displayed comparison rows too. */
const _norm = s => String(s||"").normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase().trim();
const HIDDEN_NAME_SET = new Set([...HIDDEN, ...[...HIDDEN].map(slug=>_norm((WORDS_BY_SLUG[slug]||{}).word))]);
const isHiddenName = s => HIDDEN_NAME_SET.has(_norm(s));

/* ============================================================
   VERSION 2 — Mock backend (localStorage stands in for
   Node/Express + PostgreSQL). Same API surface as spec §6.
   ============================================================ */
const Store = {
  key:(k)=>"babel:"+k,
  get(k, def){ try{ return JSON.parse(localStorage.getItem(Store.key(k))) ?? def; }catch{ return def; } },
  set(k,v){ localStorage.setItem(Store.key(k), JSON.stringify(v)); },
};

/* ============================================================
   Backend client — talks to the real Express/Prisma API
   (server/) when reachable, with a transparent localStorage
   fallback so the site keeps working when opened standalone
   (spec: "no build step, open index.html").
   ============================================================ */
let apiBasePromise = null;
function resolveApiBase(){
  if(apiBasePromise) return apiBasePromise;
  apiBasePromise = (async () => {
    for(const base of ["/api", "http://localhost:4600/api"]){
      try{
        const ctrl = new AbortController();
        const t = setTimeout(()=>ctrl.abort(), 900);
        const res = await fetch(base+"/health", {signal:ctrl.signal});
        clearTimeout(t);
        if(res.ok) return base;
      }catch(e){ /* try next candidate */ }
    }
    return null;
  })();
  return apiBasePromise;
}
async function apiFetch(path, opts={}){
  const base = await resolveApiBase();
  if(!base) throw new Error("backend unreachable");
  const token = Store.get("token", null);
  const headers = Object.assign({ "content-type":"application/json" }, opts.headers||{}, token ? {Authorization:"Bearer "+token} : {});
  const res = await fetch(base+path, Object.assign({}, opts, {headers}));
  const data = await res.json().catch(()=>({}));
  if(!res.ok) throw Object.assign(new Error(data.error||"Request failed"), {status:res.status, data});
  return data;
}

/* Synchronous saved-words cache so existing render code (wordCard, portrait)
   can keep reading API.saved() without becoming async. Hydrated from the
   backend on login/boot; falls back to a pure-local list when offline. */
let savedCache = new Set(Store.get("savedSlugs", []));
function persistSavedCache(){ Store.set("savedSlugs", [...savedCache]); }
async function hydrateSavedFromBackend(){
  if(!Store.get("token", null)) return;
  try{
    const rows = await apiFetch("/user/saved");
    savedCache = new Set(rows.map(r=>r.slug));
    persistSavedCache();
  }catch(e){ /* keep whatever was cached locally */ }
}

const API = {
  // GET /api/words/random  — Word of the Day (deterministic per day)
  wordOfDay(){
    const day = Math.floor(Date.now()/864e5);
    return VISIBLE_WORDS[day % VISIBLE_WORDS.length];
  },
  // GET /api/categories
  categories(){ const c = categoryCounts(); return CATEGORIES.map(x=>({...x, count:c[x.key]})); },
  // POST /api/submissions — screened server-side for duplicates/ambiguity when
  // the backend is reachable; local fallback just queues unscreened.
  async submit(sub){
    try{
      const r = await apiFetch("/submissions", {method:"POST", body:JSON.stringify(sub)});
      return {ok:true, queued:r.queued, flagged:r.flagged, note:r.note};
    }catch(e){
      if(e.status === 422) return {ok:false, error:e.data?.error || e.message};
      const list = Store.get("submissions", []);
      list.push({...sub, status:"pending", submitted_at:new Date().toISOString()});
      Store.set("submissions", list);
      return {ok:true, queued:list.length, offline:true};
    }
  },
  submissions(){ return Store.get("submissions", []); },

  // AUTH — POST /api/auth/register & /login, JWT stored locally.
  currentUser(){ return Store.get("authUser", null); },
  async register(email, pass, name){
    try{
      const r = await apiFetch("/auth/register", {method:"POST", body:JSON.stringify({email, password:pass, name})});
      Store.set("token", r.token); Store.set("authUser", r.user);
      await hydrateSavedFromBackend();
      return {ok:true};
    }catch(e){
      if(e.status) return {ok:false, error:e.data?.error || e.message};
      // offline fallback (localStorage-only demo account)
      const users = Store.get("users", {});
      if(users[email]) return {ok:false, error:"Account already exists."};
      users[email] = { hash: btoa(pass).split("").reverse().join(""), name, saved:[] };
      Store.set("users", users); Store.set("authUser", {email, name}); Store.set("token", null);
      return {ok:true, offline:true};
    }
  },
  async login(email, pass){
    try{
      const r = await apiFetch("/auth/login", {method:"POST", body:JSON.stringify({email, password:pass})});
      Store.set("token", r.token); Store.set("authUser", r.user);
      await hydrateSavedFromBackend();
      return {ok:true};
    }catch(e){
      if(e.status) return {ok:false, error:e.data?.error || e.message};
      const users = Store.get("users", {});
      const u = users[email];
      if(!u || u.hash !== btoa(pass).split("").reverse().join("")) return {ok:false, error:"Invalid credentials (or the backend is offline — this demo account only exists locally)."};
      Store.set("authUser", {email, name:u.name||""}); Store.set("token", null);
      return {ok:true, offline:true};
    }
  },
  logout(){ Store.set("token", null); localStorage.removeItem(Store.key("authUser")); savedCache = new Set(); persistSavedCache(); },
  // PATCH /api/user/me — edit name and/or password
  async updateAccount(patch){
    const cur = API.currentUser();
    try{
      const r = await apiFetch("/user/me", {method:"PATCH", body:JSON.stringify(patch)});
      Store.set("authUser", {email:r.user.email, name:r.user.name});
      return {ok:true};
    }catch(e){
      if(e.status) return {ok:false, error:e.data?.error || e.message};
      // offline: update local record
      if(patch.name!=null && cur){ Store.set("authUser", {email:cur.email, name:patch.name});
        const users=Store.get("users",{}); if(users[cur.email]) users[cur.email].name=patch.name; Store.set("users",users); }
      return {ok:true, offline:true};
    }
  },
  // DELETE /api/user/me — delete account
  async deleteAccount(){
    try{ await apiFetch("/user/me", {method:"DELETE"}); }
    catch(e){ if(e.status) return {ok:false, error:e.data?.error || e.message}; }
    const cur = API.currentUser();
    if(cur){ const users=Store.get("users",{}); delete users[cur.email]; Store.set("users",users); }
    API.logout();
    return {ok:true};
  },

  // GET/POST/DELETE /api/user/saved — synchronous read from the hydrated cache;
  // the toggle call persists to the backend (or local list) then updates it.
  saved(){ return [...savedCache]; },
  async toggleSave(slug){
    const u = API.currentUser(); if(!u) return {ok:false, needAuth:true};
    const willSave = !savedCache.has(slug);
    if(willSave) savedCache.add(slug); else savedCache.delete(slug);
    persistSavedCache();
    try{
      await apiFetch("/user/saved/"+slug, {method: willSave ? "POST" : "DELETE"});
    }catch(e){ /* local cache already updated; backend will resync on next login */ }
    return {ok:true, saved:willSave};
  },

  // GET /api/user/history — Name My Feeling search history (auth required)
  async history(){
    try{ return await apiFetch("/user/history"); }
    catch(e){ return []; }
  },
  // GET/POST/DELETE /api/user/cards — saved shareable image cards
  async cards(){
    try{ return await apiFetch("/user/cards"); }
    catch(e){ return []; }
  },
  async saveCard(slug, source){
    try{ await apiFetch("/user/cards/"+slug, {method:"POST", body:JSON.stringify({source})}); return true; }
    catch(e){ return false; }
  },
  async unsaveCard(slug){
    try{ await apiFetch("/user/cards/"+slug, {method:"DELETE"}); return true; }
    catch(e){ return false; }
  },

  // Analytics — spec §12 (share/search event logging)
  track(event, data){
    const log=Store.get("events",[]); log.push({event, data, t:Date.now()}); Store.set("events", log.slice(-500));
    apiFetch("/events", {method:"POST", body:JSON.stringify({event, slug:data?.slug||""})}).catch(()=>{});
  },
};
hydrateSavedFromBackend();

/* ============================================================
   Live database hydration — the bundled data.js seeds the atlas
   so the site works standalone, but on boot we reconcile it with
   the live database (GET /api/words/all): words the admin added
   are merged in (fully browsable — atlas, search, portrait,
   recommendations) and words deleted from the DB are removed, so
   the whole site — not just the count — reflects the database.
   Falls back to the bundled data when the backend is offline.
   ============================================================ */
let LIVE_WORD_COUNT = WORDS.length;
const wordCount = () => LIVE_WORD_COUNT;

// Convert a backend word (from /api/words/:slug or /all) into the frontend shape.
const DIM_LABEL2KEY = {
  "Cognitive Science":"cognitive", "Cultural Origin":"cultural", "Linguistic Structure":"linguistic",
  "Nearest in English":"english", "Philosophy":"philosophy", "Art & Music":"art"
};
function backendToFrontendWord(bw){
  const dims = {cognitive:"",cultural:"",linguistic:"",english:"",philosophy:"",art:""};
  (bw.dimensions||[]).forEach(d=>{ const k=DIM_LABEL2KEY[d.label]; if(k) dims[k]=d.content; });
  return {
    slug:bw.slug, number:bw.number, word:bw.word, language:bw.language,
    native:bw.native||"", phonetic:bw.phonetic||"", family:bw.family||"Community",
    script:bw.script||"Latin", dist:bw.dist, intensity:bw.intensity||60,
    category:bw.category, defShort:bw.defShort, defFull:bw.defFull,
    dims, art:dims.art||"",
    cultures:bw.cultures||[], comparisons:bw.comparisons||[], related:bw.related||[],
    community:true            // flags a database/community entry (may have sparse dimensions)
  };
}

async function hydrateWordsFromBackend(){
  let all;
  try{ all = await apiFetch("/words/all"); }
  catch(e){ return hydrateWordCount(); }   // backend without this endpoint / offline
  if(!Array.isArray(all) || !all.length) return hydrateWordCount();

  const dbSlugs = new Set(all.map(w=>w.slug));
  const newOnes = all.filter(bw=>!WORDS_BY_SLUG[bw.slug]);
  const removed = WORDS.filter(w=>!dbSlugs.has(w.slug));

  // 1) merge in database words missing locally (fetch full portrait per word)
  for(const basic of newOnes){
    let full = basic;
    try{ full = await apiFetch("/words/"+basic.slug); }catch(e){ /* use basic fields */ }
    const w = backendToFrontendWord(full);
    WORDS.push(w);
    WORDS_BY_SLUG[w.slug] = w;
    if(!isHidden(w)) VISIBLE_WORDS.push(w);
    if(!LANGUAGE_FAMILIES.includes(w.family)) LANGUAGE_FAMILIES.push(w.family);
    if(!LANGUAGES.includes(w.language)) LANGUAGES.push(w.language);
  }
  // 2) drop words deleted from the database
  if(removed.length){
    removed.forEach(w=>{ delete WORDS_BY_SLUG[w.slug]; });
    WORDS.splice(0, WORDS.length, ...WORDS.filter(w=>dbSlugs.has(w.slug)));
    VISIBLE_WORDS.splice(0, VISIBLE_WORDS.length, ...VISIBLE_WORDS.filter(w=>dbSlugs.has(w.slug)));
  }

  const changed = newOnes.length || removed.length;
  if(changed) TRIE = buildTrie();                 // rebuild instant-search index
  if(LIVE_WORD_COUNT !== WORDS.length || changed){
    LIVE_WORD_COUNT = WORDS.length;
    renderNav();
    render();                                      // re-render so browse + counts reflect the DB
  }
}

// Lightweight fallback used only when /words/all is unavailable: sync the count.
async function hydrateWordCount(){
  try{
    const h = await apiFetch("/health");
    if(h && typeof h.words === "number" && h.words !== LIVE_WORD_COUNT){
      LIVE_WORD_COUNT = h.words;
      renderNav();
      render();
    }
  }catch(e){ /* offline — keep the bundled count */ }
}

/* ============================================================
   VERSION 2 — Trie-based advanced search (spec §13.6)
   ============================================================ */
function buildTrie(){
  const root = {c:{}, ids:[]};
  const add = (str, id) => {
    str = str.toLowerCase();
    for(let s=0; s<str.length; s++){
      let node = root;
      for(let i=s; i<str.length; i++){
        const ch = str[i];
        node = node.c[ch] || (node.c[ch] = {c:{}, ids:[]});
        if(!node.ids.includes(id)) node.ids.push(id);
      }
    }
  };
  WORDS.forEach(w => { add(w.word, w.slug); add(w.language, w.slug); add(w.defShort, w.slug); });
  return {
    root,
    search(q){
      q = q.trim().toLowerCase(); if(!q) return [];
      let node = this.root;
      for(const ch of q){ if(!node.c[ch]) return []; node = node.c[ch]; }
      return node.ids.slice(0,8).map(s => WORDS_BY_SLUG[s]);
    }
  };
}
let TRIE = buildTrie();

/* ============================================================
   VERSION 2 — Cognitive-distance algorithm (spec §13.9)
   Formalises the curatorial metric as a documented composite.
   ============================================================ */
const CogDistance = {
  weights:{ semantic:.35, cultural:.25, structural:.20, gap:.20 },
  // Recompute a word's score from its four components (bounded 0-100).
  compute(w){
    const semantic  = w.dist;                              // base curatorial semantic distance
    const cultural   = Math.min(100, w.cultures.length*14 + (w.script==="Non-Latin"?20:6) + 30);
    const structural = /compound|verb|reflexive/i.test(w.dims.linguistic) ? 82 : 60;
    const best = Math.max(0, ...w.comparisons.map(c=>c.sim), 0);
    const gap = 100 - best;                                // larger gap to nearest ⇒ more untranslatable
    const W = this.weights;
    return Math.round(semantic*W.semantic + cultural*W.cultural + structural*W.structural + gap*W.gap);
  }
};

/* ============================================================
   VERSION 2 — Recommendation engine (spec §13.7)
   "If you loved Saudade, you might feel Hiraeth."
   ============================================================ */
function recommend(word, n=4){
  const scored = WORDS.filter(w=>w.slug!==word.slug && !isHidden(w)).map(w=>{
    let s = 0;
    if(w.category===word.category) s += 40;
    if(w.family===word.family) s += 12;
    if(word.related.includes(w.slug)) s += 45;
    s += Math.max(0, 30 - Math.abs(w.dist-word.dist));   // similar untranslatability
    s += Math.max(0, 20 - Math.abs((w.intensity||60)-(word.intensity||60))/2);
    return {w, s};
  });
  return scored.sort((a,b)=>b.s-a.s).slice(0,n).map(x=>x.w);
}

/* ============================================================
   VERSION 2 — Local "AI" engine (offline-capable).
   Mirrors the 4-layer prompt architecture (spec §4/§7):
   phenomenology → semantic match → explanation → Sapir-Whorf.
   Returns the same JSON contract the Claude endpoint would.
   ============================================================ */
const LEX = {
  longing:["miss","missing","longing","long","gone","away","far","home","homesick","homesickness","absence","yearn","yearning","pining","pine","nostalg","nostalgia","past","lost","distance","apart","separation","return","memory","ache","heartache","wistful","wistfulness","someone i","used to","exile","estranged","displaced","abroad","fad","emigrat","grief","grieving","mourning","never see","no longer part"],
  awe:["nature","forest","trees","light","sunlight","mountain","ocean","sea","sky","vast","vastness","wonder","awe","awestruck","sublime","breathtaking","majesty","grandeur","beauty","outdoors","woods","alone in","landscape","stars","starry","wild","wilderness","rain","moon","silence","still","stillness","canyon","cathedral","storm","thunder","hush","snow","tide","dusk","reverent","reverence","sacred","overwhelming scale","amazed","farmland","night sky","scale of","horizon","waterfall","humbling","boundless"],
  social:["friend","friendship","people","together","togetherness","introduce","name","stranger","awkward","group","company","waiting","waiting for","guest","hesita","glance","look","between us","host","party","respect","kin","kinship","belong","belonging","community","camaraderie","fellowship","acquaintance","outsider","left out","family","gathering","welcomed","understood","understand","acknowledged","connection","bond","reunion","reunited","apologi","reconcile","forgiveness","introduc"],
  joy:["happy","happiness","cozy","cosy","warm","warmth","love","falling in love","cute","squeeze","cuddle","comfort","content","contentment","delight","tender","tenderness","glow","snug","joy","joyful","smile","affection","fun","cherish","giddy","giddiness","fluttery","butterflies","proud","gushing","elated","elation","blissful","bliss","overjoyed","gleeful","heartwarming","adoration","radiant","playful","silly happiness","inside joke","reunited","reunion"],
  tension:["anxious","anxiety","dread","dreading","stress","stressed","uneasy","unease","tension","tense","awkward","embarrass","cring","overwhelm","overwhelmed","panic","restless","fear","nervous","apprehension","discomfort","stuck","frozen","angry","rage","spite","irritat","frustrat","frustration","annoyance","resentment","jittery","simmering","frazzled","exhausted","exhaustion","wound-up","burned out","cornered","trapped","avoid","on edge","pressure","looming","impending","enough of","fed up"],
  time:["time","memory","again","forgot","forget","past","future","later","waiting","already","piling","books","aging","ageing","old","fading","faded","impermanen","transient","transience","fleeting","ephemeral","moment","dusk","twilight","photo","photograph","decade","holiday","decorations","autumn","season","teenage","childhood","bedroom","song","blankly","reminisce","remembrance","nostalgic","bygone","yesteryear","looking back","staring into space","rushing back","exactly the same","packing away"],
  philos:["meaning","purpose","life","balance","world","existence","soul","being","why","imperfect","impermanence","order","chaos","reason","alive","perfection","virtue","honour","honor","fate","destiny","matters","pointless","meaningless","actually matters","acceptance","control the outcome","understood only by","existential","mortality","absurdity","consciousness","awareness","transcendence","interconnected","oneness","equanimity","surrender","letting go","serenity","calm","peace","peaceful","tranquil","patience","wisdom","ineffable"]
};
/* Generic filler/function words excluded from the definition-overlap bonus so
   common words don't create spurious matches. Mirrors STOP in server/src/ai.js. */
const STOP = new Set(["feeling","feelings","feel","feels","felt","like","that","this","with","your","just","really","something","someone","somewhere","anything","everything","nothing","never","always","them","they","when","what","which","were","been","have","from","into","about","would","could","should","there","their","other","things","thing","some","much","very","more","most","being","because","while","after","before","kind","sort","even","than","then","over","only","also","here","where","those","these","such","without","within","want","wants","make","makes","know","knows"]);

/* ---------- semantic definition matching (TF-IDF cosine) ----------
   Mirrors server/src/ai.js. Distinctive words in a definition ("visited",
   "distant", "yearning") weigh far more than common ones ("place"), so the
   engine ranks the word whose definition actually paraphrases the feeling
   rather than one that merely shares a common noun. Light stemming lets
   "visit" match "visited". Kept in sync with the backend engine. */
const COS_W = 100, CAT_W = 8;
function stem(t){
  if(t.length<5) return t;
  for(const suf of ["ings","ing","edly","edness","ements","ement","ments","ment","ness","ions","tion","sion","ies","ied","ously","ous","ed","es","ly","s"]){
    if(t.endsWith(suf) && t.length-suf.length>=3) return t.slice(0, t.length-suf.length);
  }
  return t;
}
function tokenizeStem(s){
  const out=[];
  for(const t of (String(s).toLowerCase().match(/[a-z]{4,}/g)||[])){ if(STOP.has(t)) continue; out.push(stem(t)); }
  return out;
}
let _defIndex=null, _defIndexKey="";
function buildDefIndex(words){
  const key = words.length+":"+((words[0]&&words[0].slug)||"");
  if(_defIndex && _defIndexKey===key) return _defIndex;
  const N = words.length||1;
  const df = Object.create(null);
  const docs = words.map(w=>{
    const tf=Object.create(null); const seen=new Set();
    for(const t of tokenizeStem(w.defShort+" "+w.defFull)){ tf[t]=(tf[t]||0)+1; if(!seen.has(t)){ seen.add(t); df[t]=(df[t]||0)+1; } }
    return tf;
  });
  const idf = Object.create(null);
  for(const t in df) idf[t] = Math.log((N+1)/(df[t]+1))+1;
  const vecs = docs.map(tf=>{
    const vec=Object.create(null); let norm=0;
    for(const t in tf){ const v=tf[t]*idf[t]; vec[t]=v; norm+=v*v; }
    return { vec, norm:Math.sqrt(norm)||1 };
  });
  _defIndex={idf,vecs}; _defIndexKey=key;
  return _defIndex;
}
function semanticSims(text, words){
  const index=buildDefIndex(words);
  const qtf=Object.create(null);
  for(const t of tokenizeStem(text)) qtf[t]=(qtf[t]||0)+1;
  const qvec=Object.create(null); let qnorm=0;
  for(const t in qtf){ const idf=index.idf[t]; if(!idf) continue; const v=qtf[t]*idf; qvec[t]=v; qnorm+=v*v; }
  qnorm=Math.sqrt(qnorm)||1;
  return index.vecs.map(({vec,norm})=>{
    let dot=0; for(const t in qvec){ const wv=vec[t]; if(wv) dot+=qvec[t]*wv; }
    return dot/(qnorm*norm);
  });
}

function phenomenology(text){
  const t = " "+text.toLowerCase()+" ";
  const scores = {}; CATEGORIES.forEach(c=>scores[c.key]=0);
  // Multi-word phrase cues are the most specific signal, so they weigh most.
  for(const cat in LEX){ for(const kw of LEX[cat]){ if(t.includes(kw)) scores[cat] += kw.includes(" ")?3:kw.length>6?2:1; } }
  // texture signals nudge intensity
  const intensity = /deep|profound|overwhelm|unbearab|forever|ache|aching|crushing|desperat|intens|consum|drowning|shatter|wholeheart/.test(t) ? 82
                  : /slight|small|little|gentle|quiet|faint|mild|subtle|soft|barely/.test(t) ? 40 : 60;
  return { scores, intensity, length:text.length };
}
function localFeelingSearch(text){
  const ph = phenomenology(text);
  // Name My Feeling is a discovery surface: hidden words may be returned here.
  // Definition-similarity (cosine) leads; category resonance supports.
  const sims = semanticSims(text, WORDS);
  const ranked = WORDS.map((w,i)=>{
    const cos = sims[i];
    let s = cos*COS_W + ph.scores[w.category]*CAT_W;
    s += Math.max(0, 6 - Math.abs((w.intensity||60)-ph.intensity)/8);
    s += (w.dist/100)*1.5;
    return {w, s, cos};
  }).sort((a,b)=>b.s-a.s);
  const top = ranked[0];
  const best = top.w;
  const sep = top.s - (ranked[1]?.s || 0);
  const score = Math.min(97, Math.max(52, Math.round(46 + top.cos*90 + Math.min(12, sep))));
  const alternates = ranked.slice(1,5).map(r=>({
    word:r.w.word, lang:r.w.language, slug:r.w.slug,
    match: Math.min(score-2, Math.max(28, Math.round(46 + r.cos*90)))
  }));
  const explanation = writeExplanation(best, text, ph);
  const sapirWhorf = writeSapirWhorf(best);
  API.track("feeling_search", {len:text.length, best:best.slug});
  return { bestMatch:best, matchScore:score, explanation, sapirWhorf, alternates };
}
/* Three-line explanation: (1) the human emotion read from the input, (2) why
   this word, (3) how it aligns with what the user actually wrote. */
function writeExplanation(w, text, ph){
  const emo = categoryName(w.category).toLowerCase();
  const depth = ph.intensity>70 ? "and it runs deep — it presses on you, it doesn't just pass through"
              : ph.intensity<50 ? "held quietly, in a low and private register"
              : "at a steady, lived-in register";
  const words = text.trim().split(/\s+/);
  const snippet = esc(words.slice(0,10).join(" ")) + (words.length>10?"…":"");
  return `<b>What you're feeling:</b> underneath the words, this reads as <b>${emo}</b> — ${depth}.`+
    `<br><b>Why ${esc(w.word)}:</b> ${esc(w.language)} folds that exact feeling into a single word — ${esc(w.defShort.toLowerCase())}`+
    `<br><b>How it fits you:</b> your “${snippet}” points at the same ${emo} that ${esc(w.word)} names — the thing English needs a whole sentence to reach.`;
}
function writeSapirWhorf(w){
  return `Now that you have the word <i>${esc(w.word)}</i> — do you think you'll notice this feeling more often, or was it always there, just unnamed?`;
}

/* Feeling-search orchestrator. Priority: real backend (which itself runs the
   offline engine, or Claude if the server has ANTHROPIC_API_KEY set, and
   logs history for signed-in users) → a client-held Claude key, if the user
   configured one → the pure in-browser offline engine as a last resort, so
   the site always works even with no backend and no key. The returned
   `engine` field is surfaced honestly in the UI (spec item: disclose what's
   actually answering, not just claim "AI" unconditionally). */
async function claudeFeelingSearch(text){
  try{
    const r = await apiFetch("/feelings/search", {method:"POST", body:JSON.stringify({input:text})});
    const best = WORDS_BY_SLUG[r.bestMatch.slug];
    return {
      bestMatch: best, matchScore:r.matchScore, explanation:r.explanation, sapirWhorf:r.sapirWhorf,
      alternates: r.alternates.map(a=>({...WORDS_BY_SLUG[a.slug], match:a.match, word:a.word, lang:a.lang, slug:a.slug})),
      engine: r.engine || "offline", cached: r.cached, responseMs: r.responseMs, source:"backend"
    };
  }catch(e){ /* backend unreachable — fall through */ }

  const key = Store.get("claudeKey", null);
  if(key){
    try{
      const t0 = Date.now();
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST",
        headers:{ "content-type":"application/json", "x-api-key":key, "anthropic-version":"2023-06-01", "anthropic-dangerous-direct-browser-access":"true" },
        body:JSON.stringify({
          model:"claude-opus-4-8", max_tokens:900,
          system:"You are Babel's Name-My-Feeling engine. Given a feeling described in plain language and a JSON list of untranslatable words, extract the phenomenology (sensory texture, emotional register, relational + temporal character), then return STRICT JSON {bestMatchSlug, matchScore, explanation, sapirWhorf, alternates:[{slug,match}]}.",
          messages:[{ role:"user", content:`WORDS=${JSON.stringify(WORDS.map(w=>({slug:w.slug,word:w.word,lang:w.language,cat:w.category,def:w.defShort})))}\n\nFEELING: ${text}` }]
        })
      });
      const data = await res.json();
      const parsed = JSON.parse(data.content[0].text.match(/\{[\s\S]*\}/)[0]);
      const best = WORDS_BY_SLUG[parsed.bestMatchSlug] || localFeelingSearch(text).bestMatch;
      return { bestMatch:best, matchScore:parsed.matchScore, explanation:parsed.explanation,
               sapirWhorf:parsed.sapirWhorf,
               alternates:(parsed.alternates||[]).map(a=>({...WORDS_BY_SLUG[a.slug], match:a.match, word:WORDS_BY_SLUG[a.slug]?.word, lang:WORDS_BY_SLUG[a.slug]?.language, slug:a.slug})),
               engine:"claude:browser-key", responseMs:Date.now()-t0, source:"browser" };
    }catch(e){ /* fall through to local */ }
  }
  return { ...localFeelingSearch(text), engine:"offline", source:"local" };
}

/* Composer local analyser — identifies phrases and maps them to words. */
function analyseText(text){
  const sentences = text.split(/(?<=[.!?])\s+|\n+/).filter(s=>s.trim().length>8);
  const found = [];
  const usedSlugs = new Set();
  sentences.forEach(sent=>{
    const ph = phenomenology(sent);
    // Same TF-IDF cosine engine as Name My Feeling — definition similarity leads.
    const sims = semanticSims(sent, WORDS);
    let bestPick = null;
    WORDS.forEach((w,i)=>{
      if(usedSlugs.has(w.slug) || isHidden(w)) return;
      const s = sims[i]*COS_W + ph.scores[w.category]*CAT_W;
      if(!bestPick || s>bestPick.s) bestPick = {w, s, cos:sims[i]};
    });
    if(bestPick && (bestPick.cos > 0.06 || bestPick.s > 8)){
      const w = bestPick.w; usedSlugs.add(w.slug);
      // pick a phrase: the whole sentence trimmed, or a salient clause
      const phrase = sent.trim().replace(/\s+/g," ");
      found.push({
        phrase, word:w.word, lang:w.language, slug:w.slug, def:w.defShort,
        why:`This line's ${categoryName(w.category).toLowerCase()} register — its ${ph.intensity>70?"depth":"quiet texture"} — maps onto <b>${esc(w.word)}</b>, which names exactly ${esc(w.defShort.toLowerCase())}`
      });
    }
  });
  return found.slice(0,5);
}

/* ============================================================
   Shared UI atoms
   ============================================================ */
function distBar(pct){ return `<div class="dbar"><span style="width:${pct}%"></span></div>`; }
function catTag(key){ return `<span class="tag cat" style="border-color:${CAT_COLOR[key]}44;color:${CAT_COLOR[key]}">${esc(categoryName(key))}</span>`; }

function speakBtn(slug, extra=""){
  return `<button class="speak-btn ${extra}" title="Hear the pronunciation" aria-label="Hear the pronunciation of this word"
    onclick="event.preventDefault();event.stopPropagation();BABELAPP.speak('${slug}',this)">🔊</button>`;
}
function wordCard(w){
  const saved = API.saved().includes(w.slug);
  return `<a class="card page-fade" href="#/word/${w.slug}" style="display:block">
    <span class="glow"></span>
    <div class="wc-head">
      <span class="wc-meta">${esc(w.language)} · ${esc(w.family)}</span>
      <span class="wc-meta">№${String(w.number).padStart(3,"0")}</span>
    </div>
    <div class="wc-word-row"><div class="wc-word">${esc(w.word)}</div>${speakBtn(w.slug)}</div>
    <div class="wc-native">${esc(w.native||"")}</div>
    <div class="wc-def">${esc(w.defShort)}</div>
    <div class="wc-dist">${distBar(w.dist)}<span class="num">${w.dist}%</span></div>
    <div class="wc-cats">${catTag(w.category)}${saved?'<span class="tag active">★ saved</span>':''}</div>
    <span class="wc-open">Open portrait →</span>
  </a>`;
}

/* ============================================================
   Pronunciation (Web Speech API — no external dependency, works
   offline). Speaks the word in its native script when a matching
   voice/locale is available, otherwise the romanized form; the
   utterance locale is set from the language where we can map it,
   so voices pronounce it far better than a default English voice. */
const LANG_BCP47 = {
  "Japanese":"ja-JP","Mandarin Chinese":"zh-CN","Cantonese":"zh-HK","Korean":"ko-KR",
  "German":"de-DE","French":"fr-FR","Spanish":"es-ES","Portuguese":"pt-PT","Portuguese (Brazil)":"pt-BR",
  "Italian":"it-IT","Russian":"ru-RU","Ukrainian":"uk-UA","Polish":"pl-PL","Czech":"cs-CZ","Dutch":"nl-NL",
  "Swedish":"sv-SE","Norwegian":"nb-NO","Danish":"da-DK","Finnish":"fi-FI","Icelandic":"is-IS",
  "Greek":"el-GR","Turkish":"tr-TR","Arabic":"ar-SA","Hebrew":"he-IL","Persian":"fa-IR","Hindi":"hi-IN",
  "Urdu":"ur-PK","Bengali":"bn-IN","Tamil":"ta-IN","Telugu":"te-IN","Malayalam":"ml-IN","Thai":"th-TH",
  "Vietnamese":"vi-VN","Indonesian":"id-ID","Malay":"ms-MY","Tagalog":"fil-PH","Hungarian":"hu-HU",
  "Romanian":"ro-RO","Welsh":"cy-GB","Catalan":"ca-ES","Sanskrit":"hi-IN","Serbian":"sr-RS",
  "Croatian":"hr-HR","Slovenian":"sl-SI","Lithuanian":"lt-LT","Latvian":"lv-LV","Estonian":"et-EE",
  "Afrikaans":"af-ZA","Swahili":"sw-KE","Zulu":"zu-ZA"
};
let _voices = [];
function loadVoices(){ try{ _voices = window.speechSynthesis ? window.speechSynthesis.getVoices() : []; }catch(e){ _voices=[]; } }
if(window.speechSynthesis){ loadVoices(); window.speechSynthesis.onvoiceschanged = loadVoices; }
function speak(slug, btn){
  const w = WORDS_BY_SLUG[slug]; if(!w) return;
  if(!window.speechSynthesis || !window.SpeechSynthesisUtterance){ toast("Your browser can't do audio pronunciation"); return; }
  window.speechSynthesis.cancel();
  const code = LANG_BCP47[w.language];
  const hasVoiceForLocale = code && _voices.some(v => v.lang && v.lang.toLowerCase().startsWith(code.slice(0,2).toLowerCase()));
  // Speak the native script only if we have a matching voice; otherwise the romanized form reads better.
  const text = (hasVoiceForLocale && w.native) ? w.native : w.word;
  const u = new SpeechSynthesisUtterance(text);
  if(code) u.lang = code;
  const voice = _voices.find(v => v.lang && code && v.lang.toLowerCase().startsWith(code.slice(0,2).toLowerCase()));
  if(voice) u.voice = voice;
  u.rate = 0.85;
  if(btn){ btn.classList.add("speaking"); u.onend = u.onerror = ()=>btn.classList.remove("speaking"); }
  window.speechSynthesis.speak(u);
  API.track("pronounce", {slug});
}

/* ============================================================
   Navigation + chrome
   ============================================================ */
const NAV = [
  ["#/atlas","Atlas"],["#/name-my-feeling","Name My Feeling"],["#/map","Map"],
  ["#/theory","Theory"],["#/compose","Composer"],["#/sources","Sources"],["#/about","About"]
];
function renderNav(){
  const route = location.hash || "#/";
  const user = API.currentUser();
  const el = document.getElementById("nav");
  el.innerHTML = `<nav class="topnav"><div class="inner">
    <a href="#/" class="logo">Babel</a>
    <button class="nav-toggle" onclick="document.getElementById('navlinks').classList.toggle('open')">Menu</button>
    <div class="navlinks" id="navlinks">
      ${NAV.map(([h,t])=>`<a href="${h}" class="${route.startsWith(h)?'active':''}">${t}</a>`).join("")}
    </div>
    <div class="nav-pulse"><span class="pulse-dot"></span>${wordCount()} words indexed</div>
    <div class="nav-account">
      ${route.startsWith("#/admin")
        ? `<button class="btn btn-amber" onclick="BABELAPP.adminLogout()">Sign Out</button>`
        : user
          ? `<a class="btn btn-amber" href="#/account">Your Profile</a><button class="btn btn-amber" onclick="BABELAPP.logout()">Sign Out</button>`
          : `<button class="btn btn-amber" onclick="BABELAPP.openAuth()">Sign in</button>`}
    </div>
  </div></nav>`;
}

/* Toast + modal helpers */
function toast(msg){ let t=$(".toast")||(()=>{const d=document.createElement("div");d.className="toast";document.body.appendChild(d);return d;})();
  t.textContent=msg; t.classList.add("show"); clearTimeout(t._t); t._t=setTimeout(()=>t.classList.remove("show"),2200); }
function openModal(html){ let m=$("#modal"); if(!m){ m=document.createElement("div"); m.id="modal"; m.className="modal-overlay"; document.body.appendChild(m);
    m.addEventListener("click",e=>{ if(e.target===m) closeModal(); }); }
  m.innerHTML=`<div class="modal"><button class="close" onclick="BABELAPP.closeModal()">×</button>${html}</div>`; m.classList.add("open"); }
function closeModal(){ const m=$("#modal"); if(m) m.classList.remove("open"); }

function openAuth(mode){
  mode = mode==="register" ? "register" : "login";
  const isReg = mode==="register";
  const nameField = isReg ? `<div class="form-field"><label>Name</label><input id="authName" type="text" placeholder="Your name" autocomplete="name"></div>` : "";
  const toggle = isReg
    ? `Already have an account? <a onclick="BABELAPP.openAuth('login')" style="color:var(--amber);cursor:pointer">Sign in</a>`
    : `New here? <a onclick="BABELAPP.openAuth('register')" style="color:var(--amber);cursor:pointer">Create an account</a>`;
  openModal(`<span class="eyebrow">Account · saved collections</span>
    <h3 style="margin:8px 0 4px">${isReg?"Create your Babel account":"Sign in to Babel"}</h3>
    <p style="font-size:12px;margin-bottom:16px">Save words, keep your Name My Feeling history, and revisit saved image cards.${isReg?" Password of 4+ characters.":""}</p>
    ${nameField}
    <div class="form-field"><label>Email</label><input id="authEmail" type="email" placeholder="you@example.com" autocomplete="email"></div>
    <div class="form-field"><label>Password</label><input id="authPass" type="password" placeholder="••••••••" autocomplete="${isReg?'new-password':'current-password'}"></div>
    <button class="btn btn-amber btn-full" id="authSubmitBtn" onclick="BABELAPP.doAuth('${mode}')">${isReg?"Create account":"Sign in"}</button>
    <p style="font-size:11px;margin-top:14px;text-align:center;color:var(--text-muted)">${toggle}</p>`);
}
async function doAuth(mode){
  const email=$("#authEmail").value.trim(), pass=$("#authPass").value;
  const name = mode==="register" ? (($("#authName")||{}).value||"").trim() : "";
  if(mode==="register" && !name){ toast("Please enter your name"); return; }
  if(!email||!pass){ toast("Enter email and password"); return; }
  const btn = $("#authSubmitBtn"); const orig = btn?btn.textContent:""; if(btn) btn.textContent = "Please wait…";
  const r = mode==="login" ? await API.login(email,pass) : await API.register(email,pass,name);
  if(!r.ok){ toast(r.error); if(btn) btn.textContent=orig; return; }
  closeModal(); renderNav(); toast((mode==="login"?"Welcome back":"Account created") + (r.offline?" (offline demo mode)":"")); render();
}
function logout(){ API.logout(); renderNav(); toast("Signed out"); render(); }

/* ============================================================
   PAGE 1 — HOME
   ============================================================ */
function pageHome(){
  const cats = API.categories();
  const top = [...VISIBLE_WORDS].sort((a,b)=>b.dist-a.dist);
  const featured = API.wordOfDay();
  const mini = top.slice(0,4);
  // Ticker: a readable, curated subset (~48 words spread across the atlas) rather
  // than all 500 — combined with a much slower CSS animation, the words can
  // actually be read instead of blurring past. Hidden words are excluded.
  const tickerPool = VISIBLE_WORDS.filter((_,i)=>i % Math.ceil(VISIBLE_WORDS.length/48) === 0).slice(0,48);
  // Each ticker word opens its image card on click (the ticker pauses + brightens on hover).
  const tickerItems = tickerPool.map(w=>`<span class="ticker-item" title="Open ${esc(w.word)}'s image card" onclick="BABELAPP.openCard('${w.slug}','ticker')">${esc(w.word)}<small>${esc(w.language.slice(0,3).toUpperCase())}</small></span>`).join("");
  return `<div class="page-fade">
    <section class="hero"><div class="wrap-wide">
      <div class="ghost-word" style="right:-4%;bottom:-6%">${esc(featured.native||featured.word)}</div>
      <div class="hero-grid">
        <div>
          <span class="eyebrow">An atlas of untranslatable words</span>
          <h1 style="margin:1rem 0">You've felt it.<br><span class="strike">English</span> another<br>language named it.</h1>
          <div class="search-cta">
            <input id="heroSearch" placeholder="Describe a feeling you can't name…" aria-label="Describe a feeling">
            <button class="btn btn-amber" onclick="BABELAPP.heroSearch()">Search →</button>
          </div>
          <p class="hero-sub">Input a raw, unnamed feeling. Babel reads it and offers the closest of ${wordCount()} words across ${LANGUAGES.length} languages — its best estimate, not the last word.</p>
          <div class="stat-row">
            <div class="stat"><div class="n">${wordCount()}</div><div class="l">Words</div></div>
            <div class="stat"><div class="n">${LANGUAGES.length}</div><div class="l">Languages</div></div>
            <div class="stat"><div class="n">6</div><div class="l">Dimensions</div></div>
            <div class="stat"><div class="n">1</div><div class="l">Central Question</div></div>
          </div>
        </div>
        <aside class="index-panel">
          <h4>Live word index · by distance</h4>
          ${top.slice(0,7).map((w,i)=>`<div class="index-row" onclick="location.hash='#/word/${w.slug}'">
            <span class="ir-rank">${String(i+1).padStart(2,"0")}</span>
            <span class="ir-word">${esc(w.word)}</span>
            <span class="ir-lang">${esc(w.language.slice(0,3))}</span>
            <span class="ir-dist">${w.dist}%</span>
          </div>`).join("")}
        </aside>
      </div>
    </div></section>

    <section class="section"><div class="wrap-wide">
      <div class="label label-line">Word of the day</div>
      <div class="card featured" style="padding:32px">
        <span class="glow"></span>
        <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:16px">
          <div style="flex:1;min-width:260px">
            <span class="wc-meta">${esc(featured.language)} · ${esc(featured.family)} · №${String(featured.number).padStart(3,"0")}</span>
            <div class="portrait-word" style="font-size:clamp(2rem,5vw,3rem)">${esc(featured.word)}</div>
            <div class="wc-native">${esc(featured.native||"")} · ${esc(featured.phonetic)}</div>
            <p style="margin:14px 0;max-width:52ch">${esc(featured.defFull)}</p>
            <div style="display:flex;gap:8px;align-items:center;max-width:340px">${distBar(featured.dist)}<span class="ir-dist">${featured.dist}% distance</span></div>
            <div style="margin-top:18px"><a class="btn btn-amber" href="#/word/${featured.slug}">Open full portrait →</a></div>
          </div>
          <div style="min-width:200px">
            <div class="label" style="margin-bottom:10px">Four dimensions</div>
            ${["cognitive","cultural","english","philosophy"].map(k=>`<div style="margin-bottom:10px"><span class="label" style="color:${'var(--amber-dim)'}">${esc(dimLabel(k))}</span><p style="font-size:11px;margin-top:2px">${esc(featured.dims[k].slice(0,90))}…</p></div>`).join("")}
          </div>
        </div>
      </div>
      <div class="word-grid" style="margin-top:22px">${mini.map(wordCard).join("")}</div>
    </div></section>

    <div class="ticker" aria-hidden="true"><div class="ticker-track">${tickerItems}${tickerItems}</div></div>

    <section class="section"><div class="wrap-wide">
      <div class="teasers">
        <div class="teaser" onclick="location.hash='#/atlas'"><span class="label">01 · Library</span><h3>The Atlas</h3><p style="font-size:12.5px">All ${wordCount()} words, browsable, filterable, sortable.</p><span class="arrow">→</span></div>
        <div class="teaser" onclick="location.hash='#/map'"><span class="label">02 · Network</span><h3>Language Map</h3><p style="font-size:12.5px">The whole atlas as a force-directed network.</p><span class="arrow">→</span></div>
        <div class="teaser" onclick="location.hash='#/theory'"><span class="label">03 · Essay</span><h3>Theory</h3><p style="font-size:12.5px">Does naming a feeling change how often you have it?</p><span class="arrow">→</span></div>
      </div>
    </div></section>

    <section class="pullquote"><div class="wrap">
      <q>The limits of my language mean the limits of my world.</q>
      <span class="cite">Ludwig Wittgenstein</span>
    </div></section>
    ${footer()}
  </div>`;
}
function dimLabel(k){ return {cognitive:"Cognitive Science",cultural:"Cultural Origin",linguistic:"Linguistic Structure",english:"Nearest in English",philosophy:"Philosophy",art:"Art & Music"}[k]; }

function footer(){
  const scripts=["λόγος","木漏れ日","саудаде","سَعادة","hiraeth"];
  return `<footer><div class="wrap-wide">
    <div class="footer-scripts">${scripts.map((s,i)=>`<span style="top:${10+i*16}%;left:${(i*19+5)%85}%">${s}</span>`).join("")}</div>
    <div class="footer-inner">
      <div><div class="logo">Babel</div><p style="font-size:11px;max-width:30ch;margin-top:8px">An atlas of untranslatable words. ${wordCount()} entries, ${LANGUAGES.length} languages, six dimensions each.</p></div>
      <div class="navlinks" style="flex-direction:column;gap:8px">${NAV.map(([h,t])=>`<a href="${h}">${t}</a>`).join("")}</div>
      <div style="font-family:var(--font-mono);font-size:8px;color:var(--text-faint);letter-spacing:.12em">© ${new Date().getFullYear()} PROJECT BABEL<br>BUILT BY SURABHI DATTA<br><a href="#/admin" style="color:var(--text-faint)">Admin</a></div>
    </div>
  </div></footer>`;
}

/* ============================================================
   PAGE 2 — ATLAS
   ============================================================ */
const atlasState = { q:"", family:"All", category:null, band:null, script:"All", sort:"dist", page:1, per:20 };
function pageAtlas(){
  const cats = API.categories();
  const families = ["All", ...LANGUAGE_FAMILIES];
  return `<div class="page-fade">
    <div class="atlas-top"><div class="inner">
      <div style="position:relative;flex:1;min-width:200px">
        <input class="atlas-search" id="atlasSearch" placeholder="Search ${wordCount()} words…" value="${esc(atlasState.q)}" oninput="BABELAPP.atlasSearch(this.value)" autocomplete="off">
        <div id="instant"></div>
      </div>
      <span class="result-count" id="atlasCount"></span>
      <select class="control" id="atlasSort" onchange="BABELAPP.atlasSort(this.value)">
        <option value="dist">Sort: Distance ↓</option>
        <option value="az">Sort: A–Z</option>
        <option value="num">Sort: Curator's order</option>
        <option value="intensity">Sort: Intensity ↓</option>
      </select>
      <button class="btn btn-ghost filter-toggle filter-toggle" onclick="document.getElementById('filters').classList.toggle('open')">Filters</button>
    </div></div>
    <div class="family-strip">${families.map(f=>`<span class="tag ${atlasState.family===f?'active':''}" onclick="BABELAPP.atlasFamily('${f}')">${esc(f)}</span>`).join("")}</div>
    <div class="atlas-body">
      <aside class="filters" id="filters">
        <div class="filter-group"><span class="label label-line">Emotion type</span>
          <div class="filter-opt ${!atlasState.category?'active':''}" onclick="BABELAPP.atlasCat(null)"><span>All</span><span class="cnt">${WORDS.length}</span></div>
          ${cats.map(c=>`<div class="filter-opt ${atlasState.category===c.key?'active':''}" onclick="BABELAPP.atlasCat('${c.key}')"><span>${esc(c.name)}</span><span class="cnt">${c.count}</span></div>`).join("")}
        </div>
        <div class="filter-group"><span class="label label-line">Cognitive distance</span>
          <p style="font-size:10.5px;color:var(--text-faint);margin-bottom:8px">How far a word sits from anything expressible in one English word — higher = less translatable.</p>
          ${[["80-100","80–100%"],["60-80","60–80%"],["40-60","40–60%"],["0-40","Under 40%"]].map(([k,l])=>`<div class="filter-opt ${atlasState.band===k?'active':''}" onclick="BABELAPP.atlasBand('${k}')"><span>${l}</span></div>`).join("")}
          <div class="filter-opt ${!atlasState.band?'active':''}" onclick="BABELAPP.atlasBand(null)"><span>All bands</span></div>
        </div>
        <div class="filter-group"><span class="label label-line">Script</span>
          ${["All","Latin","Non-Latin"].map(s=>`<div class="filter-opt ${atlasState.script===s?'active':''}" onclick="BABELAPP.atlasScript('${s}')"><span>${s}</span></div>`).join("")}
        </div>
      </aside>
      <div>
        <div class="label label-line">The library</div>
        <div class="word-grid" id="atlasGrid"></div>
        <div style="text-align:center;margin:28px 0"><button class="btn btn-ghost" id="loadMore" onclick="BABELAPP.atlasMore()">Load more</button></div>
        <div class="label label-line">Editor's picks</div>
        <div class="picks-row">${[...VISIBLE_WORDS].sort((a,b)=>b.dist-a.dist).slice(0,3).map(wordCard).join("")}</div>
      </div>
    </div>
    ${footer()}
  </div>`;
}
function atlasFilter(){
  // Hidden words appear only when the user is actively searching (so they stay
  // discoverable), never while idly browsing the grid.
  let list = atlasState.q ? WORDS.slice() : VISIBLE_WORDS.slice();
  if(atlasState.q){ const q=atlasState.q.toLowerCase(); list=list.filter(w=>(w.word+w.language+w.defShort+w.native).toLowerCase().includes(q)); }
  if(atlasState.family!=="All") list=list.filter(w=>w.family===atlasState.family);
  if(atlasState.category) list=list.filter(w=>w.category===atlasState.category);
  if(atlasState.script!=="All") list=list.filter(w=>w.script===atlasState.script);
  if(atlasState.band){ const [lo,hi]=atlasState.band.split("-").map(Number); list=list.filter(w=>w.dist>=lo&&w.dist<hi+ (hi===100?1:0)); }
  const sorters={ dist:(a,b)=>b.dist-a.dist, az:(a,b)=>a.word.localeCompare(b.word), num:(a,b)=>a.number-b.number, intensity:(a,b)=>(b.intensity||0)-(a.intensity||0) };
  list.sort(sorters[atlasState.sort]||sorters.dist);
  return list;
}
function renderAtlasGrid(){
  const list=atlasFilter();
  const shown=list.slice(0,atlasState.page*atlasState.per);
  const grid=$("#atlasGrid"); if(!grid) return;
  grid.innerHTML=shown.map(wordCard).join("")||`<p style="grid-column:1/-1">No words match these filters.</p>`;
  $("#atlasCount").textContent=`${list.length} results`;
  $("#loadMore").style.display = shown.length<list.length ? "inline-block":"none";
}

/* ============================================================
   PAGE 3 — WORD PORTRAIT
   ============================================================ */
function pageWord(slug){
  const w=WORDS_BY_SLUG[slug];
  if(!w) return `<div class="wrap section"><h1>Word not found</h1><a class="btn btn-ghost" href="#/atlas">← Back to Atlas</a></div>`;
  // Prev/Next navigate only visible words, so hidden entries never surface here
  // (a hidden word's own portrait still points at its nearest visible neighbours).
  const vis = VISIBLE_WORDS;
  let vidx = vis.indexOf(w);
  let prev, next;
  if(vidx === -1){
    let after = vis.findIndex(x=>x.number > w.number); if(after === -1) after = 0;
    prev = vis[(after-1+vis.length)%vis.length];
    next = vis[after % vis.length];
  } else {
    prev = vis[(vidx-1+vis.length)%vis.length];
    next = vis[(vidx+1)%vis.length];
  }
  const saved=API.saved().includes(w.slug);
  const recs=recommend(w);
  const cog=CogDistance.compute(w);
  const dimKeys=["cognitive","cultural","linguistic","english","philosophy","art"];
  // Community/DB-added words may have sparse portraits — only render the sections
  // that actually have content, so nothing shows "undefined" or an empty grid.
  const populatedDims = dimKeys.filter(k=>w.dims[k] && String(w.dims[k]).trim());
  const comps = (w.comparisons||[]).filter(c=>!isHiddenName(c.word));
  const communityNote = (w.community && populatedDims.length < 6)
    ? `<p style="font-size:11.5px;color:var(--text-faint);border-left:2px solid var(--amber);padding-left:12px;margin:0 0 1.6rem">A community-contributed entry, added through the submission queue. Its full six-dimension portrait is still being researched.</p>`
    : "";
  return `<div class="page-fade">
    <section class="portrait-mast"><div class="wrap">
      <div class="ghost-word" style="right:-2%;top:10%">${esc(w.native||w.word)}</div>
      <div class="breadcrumb"><a href="#/atlas">Atlas</a> <span>/</span> <a href="#/atlas">${esc(categoryName(w.category))}</a> <span>/</span> <span style="color:var(--amber)">${esc(w.word)}</span></div>
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap">
        <div>
          <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap">
            <div class="portrait-word">${esc(w.word)}</div>
            ${speakBtn(w.slug,"speak-btn-lg")}
          </div>
          <div class="portrait-native">${esc(w.native||"")}</div>
        </div>
        <button class="save-star ${saved?'saved':''}" title="Save word" onclick="BABELAPP.toggleSave('${w.slug}',this)">${saved?'★':'☆'}</button>
      </div>
      <div class="portrait-meta">
        <span>Language <b>${esc(w.language)}</b></span>
        <span>Family <b>${esc(w.family)}</b></span>
        <span>Phonetic <b>${esc(w.phonetic)}</b></span>
        <span>Entry <b>№${String(w.number).padStart(3,"0")}</b></span>
        <span>Distance <b>${w.dist}%</b></span>
      </div>
    </div></section>

    <section class="wrap">
      <div class="portrait-nav">
        <a class="btn btn-ghost" href="#/word/${prev.slug}">← ${esc(prev.word)}</a>
        <div class="card-actions">
          <button class="btn btn-ghost" onclick="BABELAPP.shareCard('${w.slug}')">Download Image Card ⬇</button>
          <button class="btn btn-amber" onclick="BABELAPP.shareCardTo('${w.slug}')">Share Card ↗</button>
        </div>
        <a class="btn btn-ghost" href="#/word/${next.slug}">${esc(next.word)} →</a>
      </div>

      <div class="distillation">${esc(w.defShort)}</div>
      <p style="margin-bottom:2rem;font-size:14.5px">${esc(w.defFull)}</p>
      ${communityNote}

      ${populatedDims.length ? `<div class="label label-line">The six dimensions</div>
      <div class="dims-grid">
        ${populatedDims.map(k=>`<div class="dim"><span class="label">${esc(dimLabel(k))}</span><p>${esc(w.dims[k])}</p></div>`).join("")}
      </div>` : ""}

      ${w.cultures && w.cultures.length ? `<div class="section">
        <div class="label label-line">Held differently across cultures</div>
        <div class="cult-grid">${w.cultures.map(c=>`<div class="cult"><h4>${esc(c.name)}</h4><p>${esc(c.content)}</p></div>`).join("")}</div>
      </div>` : ""}

      ${comps.length ? `<div class="section">
        <div class="label label-line">Closest in other languages</div>
        ${comps.map(c=>`<div class="compare-row">
          <span class="cl">${esc(c.lang)}<b>${esc(c.word)}</b></span>
          ${distBar(c.sim)}
          <span class="cn">${c.sim}%</span>
        </div>`).join("")}
      </div>` : ""}

      ${w.dims.philosophy ? `<div class="philos-moment">
        <span class="label">Philosophy moment</span>
        <q style="margin-top:10px">${esc(w.dims.philosophy)}</q>
        <p style="font-style:italic;color:var(--amber-dim)">Does naming this change how often you notice it?</p>
      </div>` : ""}

      <div class="ask-box">
        <span class="label" style="color:var(--violet)">Ask Babel</span>
        <h3 style="margin:8px 0;font-size:1.1rem">Ask anything about ${esc(w.word)}</h3>
        <p style="font-size:11px;color:var(--text-faint);margin:-2px 0 4px">Answered from this word's own six-dimension profile (or Claude, if the deployment has a key) — not free-form AI by default.</p>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin:10px 0">
          <input id="askInput" placeholder="e.g. When would I actually use this word?" style="flex:1;min-width:200px;background:rgba(107,95,232,.06);border:.5px solid rgba(107,95,232,.3);border-radius:3px;padding:10px 12px;color:var(--warm);font-family:var(--font-display);font-style:italic;outline:none">
          <button class="btn btn-violet" onclick="BABELAPP.askBabel('${w.slug}')">Ask →</button>
        </div>
        <div id="askResponse"></div>
      </div>

      <div class="section">
        <div class="label label-line">If you felt ${esc(w.word)}, you might feel…</div>
        <div class="nearby-strip">${recs.map(wordCard).join("")}</div>
      </div>

      <div class="label label-line" style="margin-top:2rem">Cognitive-distance breakdown</div>
      <p style="font-size:11.5px;color:var(--text-faint);margin-bottom:6px">Cognitive distance: how far this concept sits from anything expressible in a single English word.</p>
      <p style="font-size:12px">Curatorial score <b style="color:var(--amber-light)">${w.dist}%</b> · algorithmic composite <b style="color:var(--amber-light)">${cog}%</b> (semantic ·35 + cultural ·25 + structural ·20 + gap ·20). See <a href="#/about" style="color:var(--amber)">methodology</a>.</p>
    </section>
    ${footer()}
  </div>`;
}
function askBabel(slug){
  const w=WORDS_BY_SLUG[slug]; const q=$("#askInput").value.trim();
  const box=$("#askResponse");
  box.innerHTML=`<div class="ai-response"><span class="loading-word" style="font-size:1rem">Consulting Babel…</span></div>`;
  API.track("ask_babel",{slug});
  setTimeout(()=>{
    const answer = `<b>${esc(w.word)}</b> ${w.dims.cognitive.toLowerCase().startsWith("names")?"":"— "}${esc(w.dims.cognitive)} `+
      `In practice: ${esc(w.defShort.toLowerCase())} You'd reach for it ${w.intensity>70?"in a heavy, wholehearted moment":"in an everyday, low-stakes moment"} — the kind English makes you explain in a whole sentence. `+
      (q?`As for “${esc(q)}”: the honest answer is that ${esc(w.language)} lets you say in one word what English can only circle. `:"")+
      `<br><br><span style="color:var(--violet)">Sapir-Whorf: ${esc(writeSapirWhorf(w))}</span>`;
    box.innerHTML=`<div class="ai-response">${answer}</div>`;
  },700);
}

/* ============================================================
   PAGE 4 — NAME MY FEELING
   ============================================================ */
function pageNMF(prefill){
  const examples=[
    "The ache of missing a place I've never actually been to",
    "That look between two people who both want to speak first",
    "Sunlight coming through the leaves on a slow afternoon"
  ];
  return `<div class="page-fade"><section class="section"><div class="wrap-wide">
    <div class="nmf-grid">
      <div class="nmf-input">
        <span class="eyebrow" style="color:var(--violet)">Semantic search · ${LANGUAGES.length} languages</span>
        <h1 style="font-size:clamp(1.8rem,4vw,2.8rem);margin:1rem 0">Describe what you're feeling.</h1>
        <p style="margin-bottom:.6rem">Write it plainly — the texture, the register, who it involves. Babel reads the phenomenology of what you wrote before it matches, so the result fits <i>your</i> feeling, not just your keywords.</p>
        <p style="margin-bottom:1.4rem;font-size:11.5px;color:var(--text-faint)">Honest disclosure: matching runs on Babel's own scoring engine by default. It's a best estimate from ${wordCount()} curated entries, not verified linguistic fact. Measured accuracy is on the <a href="#/about" style="color:var(--amber-dim)">About page</a>.</p>
        <textarea id="nmfInput" maxlength="300" placeholder="It's a kind of longing, but sweet — like I'm homesick for something that never happened…">${esc(prefill||"")}</textarea>
        <div class="char-count"><span id="nmfCount">${(prefill||"").length}</span>/300</div>
        <div class="chips">${examples.map(e=>`<span class="chip" onclick="BABELAPP.nmfExample(this)">${esc(e)}</span>`).join("")}</div>
        <button class="btn btn-amber btn-full" onclick="BABELAPP.nmfSearch()">Search all languages →</button>
        <div class="lang-hint">Searching ${LANGUAGES.slice(0,4).join(" · ")}…</div>
      </div>
      <div class="nmf-result" id="nmfResult">
        <div class="nmf-empty"><p>The word for what you're carrying<br>is waiting on the left.</p></div>
      </div>
    </div>
  </div></section>${footer()}</div>`;
}
function nmfSearch(){
  const text=$("#nmfInput").value.trim();
  if(text.length<4){ toast("Describe the feeling a little more"); return; }
  const box=$("#nmfResult");
  const langs=LANGUAGES.slice();
  let i=0;
  box.innerHTML=`<div style="min-height:250px;display:flex;align-items:center;justify-content:center"><div class="loading-word" id="loadCycle">Searching ${langs[0]}…</div></div>`;
  const cyc=setInterval(()=>{ i=(i+1)%langs.length; const el=$("#loadCycle"); if(el) el.textContent=`Searching ${langs[i]}…`; },420);
  claudeFeelingSearch(text).then(r=>{
    clearInterval(cyc);
    renderNMFResult(r);
  });
}
function engineLabel(r){
  const eng = (r.engine||"offline").startsWith("claude") ? "Claude AI" : "offline scoring engine";
  const timing = r.responseMs!=null ? `${r.cached?"cached · ":""}${r.responseMs}ms` : "";
  return `${eng}${timing?" · "+timing:""}`;
}
function renderNMFResult(r){
  const w=r.bestMatch;
  $("#nmfResult").innerHTML=`<div class="page-fade">
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:10px">
      <span class="match-pill">Best match · ${r.matchScore}% semantic fit</span>
      <span class="wc-meta" title="Which engine actually answered this search">answered by ${esc(engineLabel(r))}</span>
    </div>
    <div class="card featured" style="margin-bottom:16px">
      <span class="glow"></span>
      <span class="wc-meta">${esc(w.language)} · ${esc(w.family)}</span>
      <div class="wc-word" style="font-size:2.2rem">${esc(w.word)}</div>
      <div class="wc-native">${esc(w.native||"")} · ${esc(w.phonetic)}</div>
      <p style="font-style:italic;font-family:var(--font-display);color:var(--warm-bright);margin:8px 0">${esc(w.defShort)}</p>
      <div style="display:flex;gap:8px;align-items:center">${distBar(r.matchScore)}<span class="ir-dist">${r.matchScore}%</span></div>
    </div>
    <div class="label label-line">Cross-language alternatives</div>
    ${r.alternates.map(a=>`<div class="compare-row alt-row" title="Open ${esc(a.word||"")}'s image card" onclick="BABELAPP.openCard('${a.slug}','feeling')"><span class="cl">${esc(a.lang||"")}<b>${esc(a.word||"")}</b></span>${distBar(a.match)}<span class="cn">${a.match}%</span><span class="alt-hint">card ↗</span></div>`).join("")}
    <div class="sw-box"><span class="label">Sapir-Whorf provocation</span><p>${r.sapirWhorf}</p></div>
    <div class="ai-response">${r.explanation}</div>
    <div style="display:flex;gap:8px;margin-top:16px;flex-wrap:wrap">
      <a class="btn btn-amber" href="#/word/${w.slug}">Read the full portrait →</a>
      <button class="btn btn-ghost" onclick="BABELAPP.shareCard('${w.slug}','feeling')">Download Image Card ⬇</button>
      <button class="btn btn-amber" onclick="BABELAPP.shareCardTo('${w.slug}','feeling')">Share Card ↗</button>
    </div>
  </div>`;
  if(window.innerWidth<1024) $("#nmfResult").scrollIntoView({behavior:"smooth"});
}

/* ============================================================
   PAGE 5 — LANGUAGE MAP (force-directed, vanilla SVG)
   ============================================================ */
const mapState={ mode:"network", colorBy:"emotion", filterCat:null, selected:null, transform:{x:0,y:0,k:1}, pausedUntil:0 };
let mapSim=null;
function pageMap(){
  return `<div class="page-fade"><section class="section"><div class="wrap-wide">
    <span class="eyebrow">The atlas as a network</span>
    <h1 style="margin:.8rem 0">Language Map</h1>
    <p style="max-width:60ch;margin-bottom:1rem">Every word is a node, sized by cognitive distance, coloured by emotional cluster. Edges link words that share a category. Drag to reposition, scroll to zoom, click to open — the layout pauses briefly when you click so you can read the word.</p>
    <div style="max-width:66ch;margin-bottom:1.5rem;font-size:12.5px;color:var(--text-muted)">
      <div style="padding:3px 0"><b style="color:var(--amber-light)">Network</b> — words as a force-directed web, clustered by emotion, with links between related concepts.</div>
      <div style="padding:3px 0"><b style="color:var(--amber-light)">Family tree</b> — the same words sorted into columns by emotion category, showing how each cluster is populated.</div>
      <div style="padding:3px 0"><b style="color:var(--amber-light)">Distance scatter</b> — words plotted by cognitive distance (left→right) against emotional intensity (bottom→top).</div>
    </div>
    <div class="map-layout">
      <div>
        <div class="mode-toggle">
          ${[["network","Network"],["tree","Family tree"],["scatter","Distance scatter"]].map(([k,l])=>`<span class="tag ${mapState.mode===k?'active':''}" data-mode="${k}" onclick="BABELAPP.mapMode('${k}')">${l}</span>`).join("")}
          <select class="control" onchange="BABELAPP.mapColor(this.value)" style="margin-left:8px">
            <option value="emotion">Colour: Emotion</option>
            <option value="family">Colour: Family</option>
            <option value="distance">Colour: Distance</option>
          </select>
        </div>
        <div class="map-canvas-wrap">
          <div class="map-controls">
            ${CATEGORIES.map(c=>`<span class="tag" style="border-color:${CAT_COLOR[c.key]}55;color:${CAT_COLOR[c.key]}" onclick="BABELAPP.mapFilter('${c.key}')">${esc(c.name)}</span>`).join("")}
            <span class="tag" onclick="BABELAPP.mapFilter(null)">All</span>
          </div>
          <svg id="mapSvg" viewBox="0 0 800 560"></svg>
          <div class="map-tooltip" id="mapTip"></div>
          <div class="map-zoom">
            <button onclick="BABELAPP.mapZoom(1.25)">+</button>
            <button onclick="BABELAPP.mapZoom(0.8)">−</button>
            <button onclick="BABELAPP.mapZoom(0)" title="reset">◎</button>
          </div>
        </div>
      </div>
      <aside class="map-sidebar">
        <h4>Selected word</h4>
        <div id="mapDrawer"><p style="font-size:12px">Click a node to inspect it.</p></div>
        <h4 style="margin-top:24px">Emotion clusters</h4>
        ${CATEGORIES.map(c=>`<div class="legend-item" onclick="BABELAPP.mapFilter('${c.key}')"><span class="legend-dot" style="background:${CAT_COLOR[c.key]}"></span>${esc(c.name)} <span style="margin-left:auto;color:var(--text-faint);font-family:var(--font-mono);font-size:8px">${categoryCounts()[c.key]}</span></div>`).join("")}
      </aside>
    </div>
  </div></section>${footer()}</div>`;
}
function initMap(){
  const svg=$("#mapSvg"); if(!svg) return;
  const NS="http://www.w3.org/2000/svg";
  const W=800,H=560;
  const nodes=VISIBLE_WORDS.map(w=>({ w, x:W/2+(Math.random()-.5)*300, y:H/2+(Math.random()-.5)*300, vx:0, vy:0, r:5+(w.dist/100)*9 }));
  const byCat={}; nodes.forEach(n=>{ (byCat[n.w.category]=byCat[n.w.category]||[]).push(n); });
  const links=[];
  Object.values(byCat).forEach(group=>{ for(let i=0;i<group.length;i++){ const a=group[i], b=group[(i+1)%group.length]; if(group.length>1) links.push([a,b]); } });
  nodes.forEach(n=>{ n.w.related.forEach(rs=>{ const t=nodes.find(m=>m.w.slug===rs); if(t) links.push([n,t]); }); });

  function colorOf(n){
    if(mapState.colorBy==="family"){ const fams=LANGUAGE_FAMILIES; const hue=(fams.indexOf(n.w.family)/fams.length)*360; return `hsl(${hue},45%,58%)`; }
    if(mapState.colorBy==="distance"){ const t=n.w.dist/100; return `hsl(${40-t*40},${40+t*40}%,${60-t*15}%)`; }
    return CAT_COLOR[n.w.category];
  }

  /* Build the SVG once, then per frame only update attributes — no innerHTML
     rebuild and no listener re-binding, which is what made it jittery. */
  svg.innerHTML="";
  const g=document.createElementNS(NS,"g"); svg.appendChild(g);
  const linkEls=links.map(([a,b])=>{ const l=document.createElementNS(NS,"line"); l.setAttribute("stroke","rgba(184,148,74,.08)"); l.setAttribute("stroke-width","0.5"); g.appendChild(l); return {l,a,b}; });
  const labelEls=Object.keys(byCat).map(cat=>{ const t=document.createElementNS(NS,"text"); t.setAttribute("fill",CAT_COLOR[cat]+"44"); t.setAttribute("font-family","Space Mono"); t.setAttribute("font-size","9"); t.setAttribute("text-anchor","middle"); t.setAttribute("style","text-transform:uppercase;letter-spacing:2px"); t.textContent=categoryName(cat); g.appendChild(t); return {t,group:byCat[cat]}; });
  const nodeEls=nodes.map(n=>{ const c=document.createElementNS(NS,"circle"); c.setAttribute("class","mapnode"); c.setAttribute("style","cursor:pointer;transition:r .25s ease, fill .25s ease, opacity .25s ease"); g.appendChild(c); bindNode(c,n); return c; });

  function restyle(){
    const net=mapState.mode==="network";
    linkEls.forEach(({l})=> l.style.display=net?"":"none");
    labelEls.forEach(({t})=> t.style.display=net?"":"none");
    for(let i=0;i<nodeEls.length;i++){ const c=nodeEls[i], n=nodes[i];
      const dim=mapState.filterCat && n.w.category!==mapState.filterCat, sel=mapState.selected===n.w.slug;
      c.setAttribute("r", sel?n.r*1.4:n.r); c.setAttribute("fill", colorOf(n));
      c.setAttribute("opacity", dim?0.1:0.85); c.setAttribute("stroke", sel?"#F0ECE4":"none"); c.setAttribute("stroke-width", sel?1.5:0);
    }
  }
  function positionFrame(){
    const {x,y,k}=mapState.transform; g.setAttribute("transform",`translate(${x},${y}) scale(${k})`);
    for(let i=0;i<nodeEls.length;i++){ nodeEls[i].setAttribute("cx",nodes[i].x); nodeEls[i].setAttribute("cy",nodes[i].y); }
    if(mapState.mode==="network"){
      linkEls.forEach(({l,a,b})=>{ l.setAttribute("x1",a.x); l.setAttribute("y1",a.y); l.setAttribute("x2",b.x); l.setAttribute("y2",b.y); });
      labelEls.forEach(({t,group})=>{ const cx=group.reduce((s,n)=>s+n.x,0)/group.length, cy=group.reduce((s,n)=>s+n.y,0)/group.length; t.setAttribute("x",cx); t.setAttribute("y",cy); });
    }
  }
  function bindNode(c,n){
    c.addEventListener("mouseenter",e=>{ const tip=$("#mapTip"); tip.style.display="block"; tip.innerHTML=`<div class="mt-word">${esc(n.w.word)}</div><div class="mt-def">${esc(n.w.defShort)}</div><div class="ir-dist">${n.w.dist}% · ${esc(n.w.language)}</div>`;
      const rect=svg.getBoundingClientRect(); tip.style.left=(e.clientX-rect.left+12)+"px"; tip.style.top=(e.clientY-rect.top+12)+"px"; });
    c.addEventListener("mousemove",e=>{ const tip=$("#mapTip"); const rect=svg.getBoundingClientRect(); tip.style.left=(e.clientX-rect.left+12)+"px"; tip.style.top=(e.clientY-rect.top+12)+"px"; });
    c.addEventListener("mouseleave",()=>{ $("#mapTip").style.display="none"; });
    c.addEventListener("click",e=>{ e.stopPropagation(); mapState.selected=n.w.slug; if(!sleeping) mapState.pausedUntil=Date.now()+6000; renderDrawer(n.w); restyle(); positionFrame(); wake(); });
    c.addEventListener("mousedown",e=>{ e.stopPropagation();
      const move=ev=>{ const rect=svg.getBoundingClientRect(); n.fx=(ev.clientX-rect.left-mapState.transform.x)/mapState.transform.k; n.fy=(ev.clientY-rect.top-mapState.transform.y)/mapState.transform.k; n.x=n.fx; n.y=n.fy; positionFrame(); };
      const up=()=>{ n.fx=n.fy=null; document.removeEventListener("mousemove",move); document.removeEventListener("mouseup",up); wake(true); };
      document.addEventListener("mousemove",move); document.addEventListener("mouseup",up); });
  }
  function renderDrawer(w){
    $("#mapDrawer").innerHTML=`<div class="card"><span class="wc-meta">${esc(w.language)}</span><div class="wc-word" style="font-size:1.4rem">${esc(w.word)}</div><div class="wc-def">${esc(w.defShort)}</div><div class="wc-dist">${distBar(w.dist)}<span class="num">${w.dist}%</span></div><a class="btn btn-amber btn-full" style="margin-top:12px" href="#/word/${w.slug}">Open full portrait →</a></div>`;
  }

  /* The expensive O(n²) force layout is computed ONCE, synchronously, up front —
     never inside the animation loop. That precomputes each node's resting
     position for the network view; the tree grid is precomputed too. The render
     loop then only eases every node toward its current-mode target (cheap, O(n)),
     which is what makes all three views smooth and lets them settle and freeze. */
  function stepForce(alpha){
    for(let i=0;i<nodes.length;i++){ for(let j=i+1;j<nodes.length;j++){
      const a=nodes[i],b=nodes[j]; let dx=a.x-b.x, dy=a.y-b.y; let d2=dx*dx+dy*dy||1; const f=1200/d2;
      const d=Math.sqrt(d2); dx/=d; dy/=d; a.vx+=dx*f; a.vy+=dy*f; b.vx-=dx*f; b.vy-=dy*f;
    }}
    links.forEach(([a,b])=>{ let dx=b.x-a.x, dy=b.y-a.y; const d=Math.sqrt(dx*dx+dy*dy)||1; const f=(d-70)*0.01; dx/=d; dy/=d; a.vx+=dx*f; a.vy+=dy*f; b.vx-=dx*f; b.vy-=dy*f; });
    nodes.forEach(n=>{ n.vx+=(W/2-n.x)*0.002; n.vy+=(H/2-n.y)*0.002; n.vx*=.85; n.vy*=.85; n.x+=n.vx*alpha; n.y+=n.vy*alpha; });
  }
  (function precompute(){
    let a=1; for(let it=0; it<240; it++){ stepForce(a); a*=0.96; }   // settle the network once
    nodes.forEach(n=>{ n.nx=n.x; n.ny=n.y; });                        // store as network targets
    const colW=W/CATEGORIES.length;                                   // precompute tree grid targets
    CATEGORIES.forEach((c,ci)=>{ (byCat[c.key]||[]).forEach((n,ni)=>{ n.tx=colW*ci+colW/2; n.ty=80+ni*28; }); });
    // start the entrance from a small cluster so the first view eases into place
    nodes.forEach(n=>{ n.x=W/2+(Math.random()-.5)*60; n.y=H/2+(Math.random()-.5)*60; });
  })();
  function targetFor(n){
    if(mapState.mode==="scatter") return [60+(n.w.dist/100)*680, H-40-((n.w.intensity||60)/100)*(H-80)];
    if(mapState.mode==="tree") return [n.tx, n.ty];
    return [n.nx, n.ny];
  }
  function stepLayout(){
    let mx=0;
    for(const n of nodes){ if(n.fx!=null) continue; const [tx,ty]=targetFor(n); const dx=(tx-n.x)*0.12, dy=(ty-n.y)*0.12; n.x+=dx; n.y+=dy; if(Math.abs(dx)>mx) mx=Math.abs(dx); if(Math.abs(dy)>mx) mx=Math.abs(dy); }
    return mx;
  }

  // Animation loop: eases toward targets, then sleeps (freezes) once settled.
  let raf=null, sleeping=false;
  function frame(){
    raf=null;
    if(!document.getElementById("mapSvg")) return;
    const paused = mapState.pausedUntil && Date.now()<mapState.pausedUntil;
    const mv = paused ? 1 : stepLayout();
    positionFrame();
    if(!paused && mv<0.08){ sleeping=true; return; }   // settled → stop the loop
    raf=requestAnimationFrame(frame);
  }
  function wake(){ sleeping=false; if(!raf) raf=requestAnimationFrame(frame); }

  // pan + zoom (wheel/drag) — update transform then reposition, works even when frozen
  svg.addEventListener("wheel",e=>{ e.preventDefault(); const k=mapState.transform.k*(e.deltaY<0?1.1:0.9); mapState.transform.k=Math.max(.4,Math.min(3,k)); positionFrame(); }, {passive:false});
  let panning=false,pstart=null;
  svg.addEventListener("mousedown",e=>{ if(e.target.classList.contains("mapnode"))return; panning=true; pstart={x:e.clientX-mapState.transform.x,y:e.clientY-mapState.transform.y}; });
  if(window._babelMapPan){ window.removeEventListener("mousemove",window._babelMapPan.mv); window.removeEventListener("mouseup",window._babelMapPan.up); }
  const panMv=e=>{ if(panning){ mapState.transform.x=e.clientX-pstart.x; mapState.transform.y=e.clientY-pstart.y; positionFrame(); } };
  const panUp=()=>{ panning=false; };
  window.addEventListener("mousemove",panMv); window.addEventListener("mouseup",panUp);
  window._babelMapPan={mv:panMv, up:panUp};

  mapSim={ restyle:()=>restyle(), positionFrame, wake, morph:()=>{ restyle(); wake(true); },
    zoom:(f)=>{ if(f===0){ mapState.transform={x:0,y:0,k:1}; } else { mapState.transform.k=Math.max(.4,Math.min(3,mapState.transform.k*f)); } positionFrame(); } };

  restyle(); positionFrame(); wake(true);
}

/* ============================================================
   PAGE 6 — THEORY
   ============================================================ */
function pageTheory(){
  const sections=[["s1","The central question"],["s2","The Sapir-Whorf hypothesis"],["s3","The Boroditsky colour test"],["s4","The philosophers"],["s5","What Babel believes"],["s6","Further reading"]];
  const iw=(slug,label)=>`<span class="inline-word" onmouseenter="BABELAPP.wordPopup(event,'${slug}')" onmouseleave="BABELAPP.hidePopup()" onclick="location.hash='#/word/${slug}'">${label||WORDS_BY_SLUG[slug].word}</span>`;
  return `<div class="page-fade"><div class="scroll-progress" id="scrollProg"></div>
  <section class="section"><div class="wrap-wide">
    <div class="theory-layout">
      <div class="progress-rail" id="rail">
        ${sections.map((s,i)=>`<div class="rail-dot" data-sec="${s[0]}"></div>${i<sections.length-1?'<div class="rail-line"></div>':''}`).join("")}
      </div>
      <article class="essay">
        <span class="eyebrow">The intellectual spine</span>
        <h1 style="margin:1rem 0 1.2rem">Language does not imprison thought. It illuminates it.</h1>
        <p style="font-size:12.5px;font-style:italic;color:var(--text-muted);border-left:2px solid var(--amber);padding-left:16px;margin-bottom:2rem">In brief: Babel argues language doesn't cage thought but illuminates it — a part of the Sapir-Whorf hypothesis. A word for a feeling won't create the feeling, but it can help you notice it. This essay covers the evidence, the philosophers behind that claim, and what Babel itself believes.</p>

        <div id="s1"><div class="sec-divider"><span>§ 01</span></div>
        <p class="dropcap">The central question of this whole project is deceptively simple: does having a word for a feeling change how often you have it? Babel does not claim that language builds a cage around the mind. It holds the gentler, better-evidenced position — that a word is a flashlight. Knowing ${iw('komorebi')} will not give you the experience of sunlight through leaves. But it might make you stop in it more often.</p>
        <p>When you cannot name something, you can still feel it — but you feel it in the dark. Every untranslatable word in this atlas is a light pointed at something already there in human experience, unnamed and therefore harder to hold.</p></div>

        <div id="s2"><div class="sec-divider"><span>§ 02</span></div>
        <h2>The Sapir-Whorf hypothesis</h2>
        <p>The <b>strong form</b> — that language determines thought, that you cannot think what you cannot say — is discredited. The <b>weak form</b> — linguistic relativity, that language <i>influences</i> habitual thought and attention — is alive and supported by evidence. ${iw('saudade')} does not create longing in the Portuguese; it gives the longing a home, a shape, a name to return to.</p>
        <p class="essay-quote">The limits of my language mean the limits of my world. — Wittgenstein, <i>Tractatus</i></p></div>

        <div id="s3"><div class="sec-divider"><span>§ 03</span></div>
        <h2>The Boroditsky colour test</h2>
        <p>Russian has no single word for "blue": it obligates a choice between <i>goluboy</i> (light blue) and <i>siniy</i> (dark blue). Lera Boroditsky's studies found Russian speakers discriminate blues near that boundary measurably faster — about <b>124 milliseconds</b> — than English speakers. The language trained the eye. Try it:</p>
        <div class="boroditsky">
          <span class="label">Are these two blues the same or different?</span>
          <div class="swatches"><div class="swatch" style="background:#5b8fd6"></div><div class="swatch" style="background:#3f6fbf"></div></div>
          <div style="display:flex;gap:8px;justify-content:center">
            <button class="btn btn-ghost" onclick="BABELAPP.boroditsky('same')">Same</button>
            <button class="btn btn-ghost" onclick="BABELAPP.boroditsky('diff')">Different</button>
          </div>
          <p id="boroResult" style="margin-top:14px;font-size:12.5px"></p>
        </div></div>

        <div id="s4"><div class="sec-divider"><span>§ 04</span></div>
        <h2>The philosophers</h2>
        <p><b>Wittgenstein</b> gave us the limit: the edges of language are the edges of the sayable world. <b>Heidegger</b> called language "the house of being" — a word lets a thing shine forth as what it is, which is exactly what ${iw('komorebi')} does for forest light. <b>Derrida</b> treated untranslatability not as failure but as a fertile zone — the place where meaning is richest is precisely where it refuses to cross over cleanly, as with ${iw('han')}.</p></div>

        <div id="s5"><div class="sec-divider"><span>§ 05</span></div>
        <h2>What Babel believes</h2>
        <p class="essay-quote">Human emotional experience is vastly richer than the vocabulary any single language provides. Every named feeling is a small act of rescue — a light pointed at something that was always there.</p></div>

        <div id="s6"><div class="sec-divider"><span>§ 06</span></div>
        <h2>Further reading</h2>
        ${[
          ["How Emotions Are Made","Lisa Feldman Barrett","On emotional granularity — the more emotion concepts you have, the more finely you feel."],
          ["The Positive Lexicography","Tim Lomas","The scholarly project this atlas is a spiritual cousin to."],
          ["Metaphors We Live By","Lakoff & Johnson","Cognitive semantics — thought is structured by the language we think in."],
          ["Philosophical Investigations","Ludwig Wittgenstein","Meaning is use; a word lives in the life that surrounds it."],
          ["Through the Language Glass","Guy Deutscher","A readable defence of the weak Whorfian position."],
          ["Don't Sleep, There Are Snakes","Daniel Everett","The Pirahã and the limits of linguistic universals."]
        ].map(([t,a,d])=>`<div class="card" style="margin-bottom:12px"><div class="wc-word" style="font-size:1.2rem">${esc(t)}</div><span class="wc-meta">${esc(a)}</span><p style="font-size:12px;margin-top:6px">${esc(d)}</p></div>`).join("")}
        </div>
      </article>
      <aside class="theory-toc" id="toc">
        <div class="label label-line">Contents</div>
        ${sections.map(s=>`<a href="#${s[0]}" data-sec="${s[0]}">${esc(s[1])}</a>`).join("")}
        <div class="sidebar-box" style="margin-top:20px"><span class="label">Words mentioned</span>
          ${["komorebi","saudade","han"].map(s=>`<div class="index-row" onclick="location.hash='#/word/${s}'"><span class="ir-word" style="font-size:13px">${esc(WORDS_BY_SLUG[s].word)}</span><span class="ir-dist">${WORDS_BY_SLUG[s].dist}%</span></div>`).join("")}
        </div>
        <a class="btn btn-amber btn-full" href="#/name-my-feeling" style="margin-top:14px">Find the word for what you're carrying →</a>
      </aside>
    </div>
  </div></section>${footer()}</div>`;
}
function initTheory(){
  const prog=$("#scrollProg");
  const onScroll=()=>{
    if(prog){ const h=document.documentElement; const p=h.scrollTop/(h.scrollHeight-h.clientHeight); prog.style.width=(p*100)+"%"; }
    // active section
    const secs=["s1","s2","s3","s4","s5","s6"];
    let active=secs[0];
    secs.forEach(id=>{ const el=document.getElementById(id); if(el && el.getBoundingClientRect().top<160) active=id; });
    $$("#rail .rail-dot").forEach(d=>{ d.classList.toggle("active", d.dataset.sec===active); d.classList.toggle("done", secs.indexOf(d.dataset.sec)<secs.indexOf(active)); });
    $$("#toc a").forEach(a=>a.classList.toggle("active", a.dataset.sec===active));
  };
  window.addEventListener("scroll",onScroll,{passive:true}); onScroll();
}
function boroditsky(ans){
  $("#boroResult").innerHTML = `They <b>are</b> different — <i>goluboy</i> and <i>siniy</i> to a Russian speaker. Boroditsky found Russian speakers told them apart ~124ms faster than English speakers. ${ans==='diff'?"You saw it too.":"English blurs them into one 'blue'."} The word trains the eye.`;
}

/* ============================================================
   PAGE 7 — COMPOSER
   ============================================================ */
const composeState={ tab:"write", text:"", found:[] };
function pageCompose(){
  return `<div class="page-fade"><section class="section"><div class="wrap-wide">
    <span class="eyebrow">Finds the untranslatable moments in your own words</span>
    <h1 style="margin:.8rem 0">Composer</h1>
    <p style="max-width:60ch;margin-bottom:1.5rem">Write anything — a memory, a paragraph, a mood. Babel reads your prose and underlines the moments that already have a name in another language.</p>
    <div class="compose-layout">
      <div>
        <div class="tabbar">
          <button class="${composeState.tab==='write'?'active':''}" onclick="BABELAPP.composeTab('write')">Write</button>
          <button class="${composeState.tab==='annotated'?'active':''}" onclick="BABELAPP.composeTab('annotated')">Annotated</button>
        </div>
        <div class="compose-editor" id="composeEditor"></div>
        <div class="compose-footer">
          <span class="stat-line" id="composeStat">0 words · 0 untranslatable moments found</span>
          <button class="btn btn-amber" onclick="BABELAPP.composeAnalyse()">Analyse my text →</button>
        </div>
      </div>
      <aside>
        <div class="label label-line">Words found in your text <span id="foundCount"></span></div>
        <div id="palette"><p style="font-size:12px">Write something and analyse it to see the untranslatable words hidden in your prose.</p></div>
        <div class="export-box">
          <span class="label" style="margin-bottom:10px;display:block">Export</span>
          <button class="btn btn-ghost btn-full" onclick="BABELAPP.composeCopy()">Copy annotated text</button>
          <button class="btn btn-ghost btn-full" onclick="BABELAPP.composeShare()">Download Image Cards ⬇</button>
        </div>
      </aside>
    </div>
  </div></section>${footer()}</div>`;
}
function renderComposeEditor(){
  const el=$("#composeEditor"); if(!el) return;
  if(composeState.tab==="write"){
    el.innerHTML=`<div class="ghost-word" style="right:0;bottom:-10%">λέξις</div><textarea id="composeText" placeholder="I kept going back to the window, unable to sit still, waiting for a car that never came. The afternoon light fell soft through the leaves and I felt a longing for somewhere I had never been…">${esc(composeState.text)}</textarea>`;
    const ta=$("#composeText");
    ta.addEventListener("input",()=>{ composeState.text=ta.value; updateComposeStat(); });
  } else {
    let html=esc(composeState.text)||"<span style='color:var(--text-faint)'>Nothing written yet.</span>";
    // wrap matched phrases
    composeState.found.forEach((f,i)=>{
      const safe=esc(f.phrase);
      html=html.replace(safe, `<span class="mark" data-i="${i}" onmouseenter="BABELAPP.composePopup(event,${i})" onmouseleave="BABELAPP.hidePopup()" onclick="location.hash='#/word/${f.slug}'">${safe}</span>`);
    });
    el.innerHTML=`<div class="annotated page-fade">${html}</div>`;
  }
}
function updateComposeStat(){
  const words=(composeState.text.trim().match(/\S+/g)||[]).length;
  const s=$("#composeStat"); if(s) s.textContent=`${words} words · ${composeState.found.length} untranslatable moments found`;
}

/* ============================================================
   PAGE 8 — ABOUT
   ============================================================ */
function pageAbout(){
  return `<div class="page-fade"><section class="section"><div class="wrap-wide">
    <div class="about-layout">
      <div>
        <span class="eyebrow">The builder's note</span>
        <h1 style="margin:1rem 0">Why this exists</h1>
        <p>It started with a feeling I couldn't name. Standing in a patch of afternoon light coming through leaves, I felt something specific and complete — and had no word for it. English made me explain it in a whole clumsy sentence. Japanese had it in one: ${'<a href="#/word/komorebi" style="color:var(--amber)">komorebi</a>'}. I wondered how many other feelings I was carrying that I'd simply never been handed a word for. Babel is the atlas I went looking for and couldn't find.</p>

        <h2 style="margin:2rem 0 1rem">The gap between feeling and language</h2>
        <p>Human emotional experience is vastly richer than any single language's vocabulary. When you can't name something, you still feel it — but you feel it in the dark. Every word in this atlas is a flashlight pointed at something that was already there.</p>

        <h2 style="margin:2rem 0 1rem">What Babel is not</h2>
        <ul class="not-list">
          <li>Not a translation tool — it maps concepts that resist translation by definition</li>
          <li>Not a dictionary — definitions are multi-dimensional portraits, not entries</li>
          <li>Not a list of "fun foreign words" — every word names a genuine gap in English</li>
          <li>Not neutral — it holds a position: a part of the Sapir-Whorf hypothesis</li>
        </ul>

        <h2 style="margin:2rem 0 1rem">The methodology</h2>
        <p><b>Cognitive distance</b>, in one line: a 0–100% score for how far a concept sits from anything expressible in a single English word — higher means English needs a whole sentence to say what this word says in one. Each word is researched across six dimensions: cognitive science, cultural origin, linguistic structure, nearest English, philosophy, and art. The score itself is an honestly curatorial one — not a scientific measurement — combining semantic distance (·35), cultural specificity (·25), structural untranslatability (·20), and the gap to the nearest English equivalent (·20). Every portrait shows both the curatorial score and the algorithmic composite so you can see the seam. Where the definitions and cross-cultural notes come from is covered honestly on the <a href="#/sources" style="color:var(--amber)">sources page</a>.</p>

        <h2 style="margin:2rem 0 1rem">The AI integration</h2>
        <p><b>Name My Feeling</b> and <b>Composer</b> run a four-layer engine: phenomenology extraction → semantic matching against all ${wordCount()} word profiles → a bespoke explanation of why <i>this</i> word fits <i>your</i> input → a Sapir-Whorf provocation. Both the word-matching and the explanations are generated by this engine, not hand-picked per query. By default that engine is Babel's own offline scoring model — a heuristic, not a large language model — described honestly on the search page and shown per-result; supply a Claude API key on the server and it upgrades to the full model. The builder designed the prompt schema, the JSON contract, and the matching algorithm; the model (or the algorithm, offline) writes the prose. Where it's the offline engine, treat the result as a best estimate, not a verdict.</p>
        <p id="metricsSentence" style="font-size:12.5px;border-left:2px solid var(--amber);padding-left:14px;color:var(--text-muted)">Measuring accuracy…</p>

        <h2 style="margin:2rem 0 1rem">Built with</h2>
        <div class="stack-pills">${["Vanilla JS SPA","Node.js + Express","Prisma ORM","SQLite / PostgreSQL-ready","JWT + bcrypt auth","Claude API (optional)","Offline scoring engine","Force-directed SVG network","HTML Canvas","Trie search"].map(p=>`<span class="tag">${esc(p)}</span>`).join("")}</div>

        <h2 style="margin:2.4rem 0 1rem">Submit a word</h2>
        <div class="card" style="padding:22px">
          <div class="form-field"><label>The word</label><input id="subWord" placeholder="e.g. Sobremesa"></div>
          <div class="form-field"><label>Language</label><input id="subLang" placeholder="e.g. Spanish"></div>
          <div class="form-field"><label>Why is it untranslatable?</label><textarea id="subWhy" rows="3" placeholder="What gap in English does it name? (15+ characters)"></textarea></div>
          <div style="display:flex;gap:12px;flex-wrap:wrap">
            <div class="form-field" style="flex:1"><label>Your name (optional)</label><input id="subName"></div>
            <div class="form-field" style="flex:1"><label>Email (optional)</label><input id="subEmail" type="email"></div>
          </div>
          <button class="btn btn-amber" onclick="BABELAPP.submitWord()">Submit for review →</button>
          <p style="font-size:11px;margin-top:10px" id="subStatus">Screened for duplicates, accuracy, and vague entries, then reviewed by hand before addition.</p>
        </div>
      </div>
      <aside>
        <div class="sidebar-box">
          <span class="label">The atlas in numbers</span>
          <div class="mini-stat"><span>Words</span><b>${wordCount()}</b></div>
          <div class="mini-stat"><span>Languages</span><b>${LANGUAGES.length}</b></div>
          <div class="mini-stat"><span>Families</span><b>${LANGUAGE_FAMILIES.length}</b></div>
          <div class="mini-stat"><span>Dimensions each</span><b>6</b></div>
          <div class="mini-stat"><span>Highest distance</span><b>${Math.max(...WORDS.map(w=>w.dist))}%</b></div>
        </div>
        <div class="builder-card">
          <div style="display:flex;gap:14px;align-items:center;margin-bottom:14px">
            <div class="avatar">SD</div>
            <div><div style="font-family:var(--font-display);font-style:italic;font-size:1.2rem;color:var(--warm-bright)">Surabhi Datta</div><span class="wc-meta">Builder · designer</span></div>
          </div>
          <p style="font-size:12px">Interested in language, cognition, and the seam where the two meet. Babel is a portfolio project and a genuine attempt to name what's hard to hold.</p>
          <div class="navlinks" style="flex-direction:column;gap:6px;margin-top:12px">
            <a href="https://www.linkedin.com/in/surabhi-datta-191a6837a/" target="_blank" rel="noopener">LinkedIn ↗</a><a href="https://github.com/SurabhiD2008" target="_blank" rel="noopener">GitHub ↗</a>
          </div>
        </div>
        <div class="sidebar-box" style="margin-top:16px">
          <span class="label">More pages</span>
          ${[["#/","Home"],...NAV].map(([h,t])=>`<a href="${h}" style="display:block;font-size:12px;padding:5px 0;color:var(--text-muted)">${t} →</a>`).join("")}
        </div>
      </aside>
    </div>
  </div></section>${footer()}</div>`;
}
async function initAbout(){
  const el=$("#metricsSentence"); if(!el) return;
  const FALLBACK = { sampleSize:50, categoryMatchRate:90, avgResponseMs:53 };
  let m = FALLBACK, live=false;
  try{ m = await apiFetch("/metrics/benchmark"); live=true; }catch(e){ /* use fallback, still real measured numbers */ }
  el.innerHTML = `<b>Measured, not claimed:</b> tested across ${m.sampleSize} independently-written inputs, ${m.categoryMatchRate}% matched their intended emotion category, average response ${m.avgResponseMs}ms${live?"":" (cached figures — live server unreachable)"}. Full methodology and per-input results on <a href="#/sources" style="color:var(--amber)">Sources</a>.`;
}

/* ============================================================
   PAGE — SOURCES
   Honest accounting of where the word entries come from and how
   they were checked — no fabricated per-word citations.
   ============================================================ */
function pageSources(){
  return `<div class="page-fade"><section class="section"><div class="wrap">
    <span class="eyebrow">Where the words come from</span>
    <h1 style="margin:1rem 0">Sources & methodology</h1>
    <p style="margin-bottom:1.6rem">This is a curatorial atlas, not a peer-reviewed lexicon — said plainly, the way the <a href="#/about" style="color:var(--amber)">About page</a> already describes the cognitive-distance score. Here's honestly what "researched" means for the ${wordCount()} entries.</p>

    <h2 style="margin:2rem 0 .8rem">What each entry draws on</h2>
    <ul class="dot-list">
      <li>Standard bilingual dictionaries and Wiktionary/Wikipedia cross-referencing for spelling, native script, and phonetic transcription.</li>
      <li>Published linguistics and cognitive-science work cited by name where it grounds a specific claim — e.g. Lera Boroditsky's colour-perception studies (Theory page), Lisa Feldman Barrett's work on emotional granularity.</li>
      <li>Editorial synthesis: each word's six-dimension portrait (cognitive science, cultural origin, linguistic structure, nearest English, philosophy, art) is written by the builder, informed by the above, not independently fact-checked by a native-speaking linguist for every one of ${wordCount()} entries.</li>
    </ul>

    <h2 style="margin:2rem 0 .8rem">What that means in practice</h2>
    <p style="margin-bottom:1rem">Treat each portrait as a well-researched starting point, not a definitive linguistic ruling — the way you'd treat a good essay, not a dictionary entry. If you speak one of these languages and something reads wrong, <a href="#/about" style="color:var(--amber)">submit a correction</a>; community submissions are screened for duplicates and vague entries, then reviewed by hand.</p>

    <h2 style="margin:2rem 0 .8rem">Name My Feeling — measured accuracy</h2>
    <p style="margin-bottom:.6rem">The AI matching engine (§ described on the <a href="#/name-my-feeling" style="color:var(--amber)">search page</a>) was benchmarked, not just described. Methodology:</p>
    <div id="sourcesMetrics" class="card" style="padding:20px"><p style="font-size:12px;color:var(--text-faint)">Loading measured results…</p></div>

    <h2 style="margin:2rem 0 .8rem">Version history</h2>
    <p>Started as a 212-word prototype per the original project brief, expanded to 500 words across 121 languages through iterative curation. The cognitive-distance algorithm, recommendation engine, and this sources page were added in review passes after the initial build — see the <a href="#/about" style="color:var(--amber)">About page</a> for what changed and why.</p>
  </div></section>${footer()}</div>`;
}
async function initSources(){
  const el=$("#sourcesMetrics"); if(!el) return;
  try{
    const m = await apiFetch("/metrics/benchmark");
    el.innerHTML = `<p style="font-size:12.5px;margin-bottom:10px">${esc(m.methodology)}</p>
      <div class="mini-stat"><span>Sample size</span><b>${m.sampleSize} inputs</b></div>
      <div class="mini-stat"><span>Category match rate</span><b>${m.categoryMatchRate}%</b></div>
      <div class="mini-stat"><span>Average match score</span><b>${m.avgMatchScore}%</b></div>
      <div class="mini-stat"><span>Average response time</span><b>${m.avgResponseMs}ms</b></div>
      <div class="mini-stat"><span>Benchmark last run</span><b>${new Date(m.generatedAt).toLocaleDateString()}</b></div>`;
  }catch(e){
    el.innerHTML = `<p style="font-size:12px;color:var(--text-faint)">Live benchmark server unreachable — last known measured result: 50 inputs, 90% category match rate, ~53ms average response. Re-run <code>node scripts/benchmark.js</code> in <code>server/</code> for fresh numbers.</p>`;
  }
}

/* ============================================================
   PAGE — ADMIN (user metrics + submission moderation)
   Gated by a shared admin key (not a public route in the nav —
   reached directly at #/admin). The key is sent as a header and
   only cached in sessionStorage for this browser tab.
   ============================================================ */
function pageAdmin(){
  const hasKey = !!sessionStorage.getItem("babel:adminKey");
  return `<div class="page-fade"><section class="section"><div class="wrap-wide">
    <span class="eyebrow" style="color:var(--violet)">Admin</span>
    <h1 style="margin:1rem 0">Site metrics</h1>
    ${hasKey ? "" : `
      <div class="card" style="padding:22px;max-width:420px">
        <p style="font-size:12px;margin-bottom:12px">Enter the admin key (set as <code>ADMIN_KEY</code> in <code>server/.env</code>) to view usage metrics and moderate submissions.</p>
        <div class="form-field"><label>Admin key</label><input id="adminKeyInput" type="password" placeholder="••••••••"></div>
        <button class="btn btn-amber" onclick="BABELAPP.adminLogin()">View metrics →</button>
        <p id="adminLoginStatus" style="font-size:11px;margin-top:10px;color:var(--text-faint)"></p>
      </div>`}
    <div id="adminBody"></div>
  </div></section>${footer()}</div>`;
}
async function adminFetch(path, opts={}){
  const key = sessionStorage.getItem("babel:adminKey");
  return apiFetch(path, Object.assign({}, opts, {headers:Object.assign({"x-admin-key":key||""}, opts.headers||{})}));
}
async function initAdmin(){
  if(!sessionStorage.getItem("babel:adminKey")) return;
  await loadAdminDashboard();
}
/* Tiny dependency-free SVG charts for the admin dashboard. */
function adminBarChart(entries){
  if(!entries.length) return `<p style="font-size:12px;color:var(--text-faint)">No data yet.</p>`;
  const max=Math.max(1,...entries.map(e=>e.value));
  const bw=48, gap=18, H=170, base=H-28, top=16, W=entries.length*(bw+gap)+gap;
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;max-width:${W}px;height:auto" role="img" aria-label="bar chart">
    <line x1="0" y1="${base}" x2="${W}" y2="${base}" stroke="rgba(184,148,74,.2)" stroke-width="0.5"/>
    ${entries.map((e,i)=>{ const x=gap+i*(bw+gap); const h=Math.max(2,Math.round((base-top)*(e.value/max))); const y=base-h;
      return `<rect x="${x}" y="${y}" width="${bw}" height="${h}" fill="${e.color||'#B8944A'}" rx="2" opacity="0.88"/>
        <text x="${x+bw/2}" y="${y-5}" fill="#D4A855" font-family="Space Mono" font-size="10" text-anchor="middle">${e.value}</text>
        <text x="${x+bw/2}" y="${H-9}" fill="rgba(237,232,222,.6)" font-family="Space Mono" font-size="7.5" text-anchor="middle">${esc(String(e.label).slice(0,9)).toUpperCase()}</text>`;
    }).join("")}
  </svg>`;
}
function adminHeatmap(cells){ // cells: [{label, value, color}]
  const max=Math.max(1,...cells.map(c=>c.value));
  return `<div style="display:flex;gap:6px;flex-wrap:wrap">${cells.map(c=>{
    const t=c.value/max, op=(0.16+t*0.84).toFixed(2);
    return `<div title="${esc(c.label)}: ${c.value}" style="flex:1;min-width:96px;height:60px;border-radius:3px;background:${c.color};opacity:${op};display:flex;flex-direction:column;justify-content:center;align-items:center;color:#07060E">
      <div style="font-family:var(--font-mono);font-size:16px;font-weight:700">${c.value}</div>
      <div style="font-family:var(--font-mono);font-size:7px;text-transform:uppercase;letter-spacing:.06em;text-align:center;padding:0 4px">${esc(c.label)}</div>
    </div>`;
  }).join("")}</div>`;
}
async function loadAdminDashboard(){
  const body=$("#adminBody"); if(!body) return;
  body.innerHTML = `<p style="font-size:12px;color:var(--text-faint)">Loading metrics…</p>`;
  let m, subs;
  try{
    m = await adminFetch("/admin/metrics");
    subs = await adminFetch("/admin/submissions?status=pending");
  }catch(e){
    sessionStorage.removeItem("babel:adminKey");
    render(); // re-render #/admin so the key form reappears (session key was cleared above)
    const status=$("#adminLoginStatus"); if(status) status.innerHTML=`<span style="color:var(--amber-light)">Wrong key, or the backend isn't running — try again.</span>`;
    return;
  }
  body.innerHTML = `
    <div class="picks-row" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr));margin-bottom:1.6rem">
      <div class="card"><span class="wc-meta">Users</span><div class="wc-word" style="font-size:1.8rem">${m.users}</div></div>
      <div class="card"><span class="wc-meta">Saved words</span><div class="wc-word" style="font-size:1.8rem">${m.savedWords}</div></div>
      <div class="card"><span class="wc-meta">Shared cards</span><div class="wc-word" style="font-size:1.8rem">${m.sharedCards ?? 0}</div></div>
      <div class="card"><span class="wc-meta">Feeling searches (logged in)</span><div class="wc-word" style="font-size:1.8rem">${m.userSearches}</div></div>
      <div class="card"><span class="wc-meta">Cached AI responses</span><div class="wc-word" style="font-size:1.8rem">${m.cachedAiResponses}</div></div>
    </div>
    <div class="label label-line">Event activity <span style="color:var(--text-faint);font-family:var(--font-mono);font-size:8px">bar chart</span></div>
    <div class="card" style="margin-bottom:1.6rem">${adminBarChart(Object.entries(m.events).map(([k,v])=>({label:k, value:v})))}</div>

    <div class="label label-line">Search activity by emotion category <span style="color:var(--text-faint);font-family:var(--font-mono);font-size:8px">heatmap</span></div>
    <p style="font-size:10.5px;color:var(--text-faint);margin-bottom:8px">Brighter = more Name-My-Feeling searches landing in that category.</p>
    <div style="margin-bottom:1.6rem">${adminHeatmap(CATEGORIES.map(c=>{ const found=m.mostSearchedCategories.find(x=>x.category===c.key); return {label:c.name, value:found?found.count:0, color:CAT_COLOR[c.key]}; }))}</div>

    <div class="label label-line">Submissions by status <span style="color:var(--text-faint);font-family:var(--font-mono);font-size:8px">bar chart</span></div>
    <div class="card" style="margin-bottom:1.6rem">${adminBarChart(Object.entries(m.submissionsByStatus).map(([k,v])=>({label:k.replace('rejected_','rej. '), value:v, color:/reject/.test(k)?'#C77D5A':/accept/.test(k)?'#5FA8A0':'#B8944A'})))}</div>

    <div class="label label-line">Most-searched categories</div>
    ${m.mostSearchedCategories.length ? m.mostSearchedCategories.map(c=>`<div class="compare-row"><span class="cl"><b>${esc(c.name)}</b></span>${distBar(Math.round(c.count/(m.mostSearchedCategories[0].count||1)*100))}<span class="cn">${c.count}</span></div>`).join("") : `<p style="font-size:12px;color:var(--text-faint)">No feeling searches yet.</p>`}
    <div class="label label-line" style="margin-top:1.6rem">Most-viewed word portraits</div>
    ${m.mostViewedWords.length ? m.mostViewedWords.map(v=>`<div class="compare-row"><a href="#/word/${v.slug}" class="cl"><b>${esc(WORDS_BY_SLUG[v.slug]?.word||v.slug)}</b></a>${distBar(Math.round(v.views/(m.mostViewedWords[0].views||1)*100))}<span class="cn">${v.views}</span></div>`).join("") : `<p style="font-size:12px;color:var(--text-faint)">No page views logged yet.</p>`}
    <div class="label label-line" style="margin-top:1.6rem">Submissions by status</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:1.6rem">${Object.entries(m.submissionsByStatus).map(([k,v])=>`<span class="tag">${esc(k)}: ${v}</span>`).join("")||"<p style='font-size:12px;color:var(--text-faint)'>None yet.</p>"}</div>
    <div class="label label-line">Pending review queue (${subs.length})</div>
    ${subs.length ? subs.map(s=>`<div class="card" style="margin-bottom:10px">
        <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px">
          <div><div class="wc-word" style="font-size:1.2rem">${esc(s.word)}</div><span class="wc-meta">${esc(s.language)} · ${esc(s.status)}${s.submitter?" · "+esc(s.submitter):""}</span></div>
          <div style="display:flex;gap:6px"><button class="btn btn-amber" onclick="BABELAPP.adminAction(${s.id},'accept')">Accept</button><button class="btn btn-ghost" onclick="BABELAPP.adminAction(${s.id},'reject')">Reject</button></div>
        </div>
        <p style="font-size:12px;margin-top:8px">${esc(s.why)}</p>
      </div>`).join("") : `<p style="font-size:12px;color:var(--text-faint)">Nothing pending — the queue is empty.</p>`}`;
}
async function adminLogin(){
  const key=$("#adminKeyInput").value.trim();
  if(!key){ toast("Enter the admin key"); return; }
  sessionStorage.setItem("babel:adminKey", key);
  render(); // re-render #/admin without the key form
}
async function adminAction(id, action){
  try{
    const r = await adminFetch(`/admin/submissions/${id}/${action}`, {method:"POST"});
    toast(action==="accept" ? (r.added ? `Accepted — “${r.added.word}” added to the atlas` : "Accepted") : "Rejected");
    if(r.added) await hydrateWordsFromBackend();   // merge the new word into browse + sync counts
    loadAdminDashboard();
  }
  catch(e){ toast("Action failed"); }
}

/* ============================================================
   PAGE — ACCOUNT (search history, saved words, saved image cards)
   Only reachable once signed in; renders a skeleton synchronously
   then hydrates from the backend, same pattern as Map/Theory.
   ============================================================ */
function pageAccount(){
  const u = API.currentUser();
  if(!u){
    return `<div class="page-fade"><section class="section"><div class="wrap">
      <span class="eyebrow">Account</span>
      <h1 style="margin:1rem 0">Sign in to see your account</h1>
      <p style="margin-bottom:1.4rem">Search history and saved image cards are tied to your Babel account.</p>
      <button class="btn btn-amber" onclick="BABELAPP.openAuth()">Sign in →</button>
    </div></section>${footer()}</div>`;
  }
  const displayName = (u.name && u.name.trim()) ? u.name : u.email.split("@")[0];
  return `<div class="page-fade"><section class="section"><div class="wrap-wide">
    <span class="eyebrow">Your profile</span>
    <div style="display:flex;justify-content:space-between;align-items:flex-end;flex-wrap:wrap;gap:12px;margin:1rem 0">
      <div>
        <h1 style="margin:0">${esc(displayName)}</h1>
        <p class="wc-meta" style="margin-top:6px">${esc(u.email)}${Store.get("token",null)?"":" · offline demo (this device only)"}</p>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-ghost" onclick="BABELAPP.editAccount()">Edit account</button>
        <button class="btn btn-ghost" onclick="BABELAPP.deleteAccount()" style="border-color:rgba(199,125,90,.5);color:#C77D5A">Delete account</button>
      </div>
    </div>
    <p style="margin-bottom:2rem">Everything you've searched, saved, and downloaded, tied to this account.</p>

    <div class="label label-line">Saved words <span id="acctSavedCount"></span></div>
    <div class="word-grid" id="acctSavedGrid" style="margin-bottom:2.4rem"><p style="font-size:12px;color:var(--text-faint)">Loading…</p></div>

    <div class="label label-line">Saved image cards <span id="acctCardsCount"></span></div>
    <div class="word-grid" id="acctCardsGrid" style="margin-bottom:2.4rem"><p style="font-size:12px;color:var(--text-faint)">Loading…</p></div>

    <div class="label label-line">Name My Feeling — search history <span id="acctHistCount"></span></div>
    <div id="acctHistList"><p style="font-size:12px;color:var(--text-faint)">Loading…</p></div>
  </div></section>${footer()}</div>`;
}
async function initAccount(){
  if(!API.currentUser()) return;
  const savedGrid=$("#acctSavedGrid"), cardsGrid=$("#acctCardsGrid"), histList=$("#acctHistList");
  if(!savedGrid) return;

  const savedSlugs = API.saved();
  const savedWords = savedSlugs.map(s=>WORDS_BY_SLUG[s]).filter(Boolean);
  $("#acctSavedCount").textContent = `(${savedWords.length})`;
  savedGrid.innerHTML = savedWords.length ? savedWords.map(wordCard).join("") : `<p style="font-size:12px;color:var(--text-faint)">No saved words yet — star a word on its portrait page.</p>`;

  const cards = await API.cards();
  $("#acctCardsCount").textContent = `(${cards.length})`;
  cardsGrid.innerHTML = cards.length ? cards.map(c=>`<div class="card">
      <span class="glow"></span>
      <div class="wc-meta">${esc(c.language)} · via ${esc(c.source)}</div>
      <div class="wc-word">${esc(c.word)}</div>
      <div class="wc-def">${esc(c.defShort)}</div>
      <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">
        <button class="btn btn-amber" style="flex:1" onclick="BABELAPP.shareCardTo('${c.slug}','${c.source}')">Share ↗</button>
        <button class="btn btn-ghost" style="flex:1" onclick="BABELAPP.shareCard('${c.slug}','${c.source}')">Re-download ⬇</button>
        <button class="btn btn-ghost" onclick="BABELAPP.unsaveCard('${c.slug}')">Remove</button>
      </div>
    </div>`).join("") : `<p style="font-size:12px;color:var(--text-faint)">No saved cards yet — download an image card from a word portrait or a feeling search to save it here.</p>`;

  const hist = await API.history();
  $("#acctHistCount").textContent = `(${hist.length})`;
  histList.innerHTML = hist.length ? hist.map(h=>`<div class="compare-row" style="grid-template-columns:1fr 140px 60px">
      <span class="cl" style="text-transform:none;letter-spacing:0;font-family:var(--font-body)">"${esc(h.input.slice(0,80))}${h.input.length>80?'…':''}"</span>
      <a href="#/word/${h.bestSlug}" class="cl"><b>${esc(h.bestWord)}</b></a>
      <span class="cn">${h.matchScore}%</span>
    </div>`).join("") : `<p style="font-size:12px;color:var(--text-faint)">No searches yet — try <a href="#/name-my-feeling" style="color:var(--amber)">Name My Feeling</a>.</p>`;
}

/* ============================================================
   VERSION 2 — Shareable image card (spec §11 / §13.8)
   Rendered to <canvas>, then downloaded as PNG or shared.
   ============================================================ */
// Draw the 1080×1080 card for a word and return the <canvas>.
function renderCardCanvas(w){
  const S=1080; const c=document.createElement("canvas"); c.width=S; c.height=S; const x=c.getContext("2d");
  x.fillStyle="#07060E"; x.fillRect(0,0,S,S);
  // grid overlay
  x.strokeStyle="rgba(184,148,74,0.05)"; x.lineWidth=1;
  for(let i=0;i<S;i+=48){ x.beginPath(); x.moveTo(i,0); x.lineTo(i,S); x.stroke(); x.beginPath(); x.moveTo(0,i); x.lineTo(S,i); x.stroke(); }
  // ghost native
  x.fillStyle="rgba(184,148,74,0.05)"; x.font="italic 900 240px 'Playfair Display', Georgia, serif"; x.textAlign="center";
  x.fillText(w.native||w.word, S/2, S-90);
  // language
  x.fillStyle="#B8944A"; x.font="24px 'Space Mono', monospace"; x.textAlign="left";
  x.fillText(w.language.toUpperCase()+" · "+w.family.toUpperCase(), 90, 200);
  // word
  x.fillStyle="#F0ECE4"; x.font="italic 900 130px 'Playfair Display', Georgia, serif";
  x.fillText(w.word, 84, 360);
  // definition (wrapped)
  x.fillStyle="rgba(237,232,222,0.7)"; x.font="italic 40px 'Playfair Display', Georgia, serif";
  wrapText(x, w.defShort, 90, 460, S-180, 54);
  // amber rule
  x.strokeStyle="#B8944A"; x.lineWidth=3; x.beginPath(); x.moveTo(90,S-230); x.lineTo(320,S-230); x.stroke();
  // distance + watermark (https so the printed link opens securely)
  x.fillStyle="#B8944A"; x.font="24px 'Space Mono', monospace";
  x.fillText(w.dist+"% COGNITIVE DISTANCE", 90, S-180);
  x.fillStyle="rgba(237,232,222,0.4)"; x.textAlign="right"; x.fillText(SITE_URL.replace(/^https?:\/\//,"https://"), S-90, S-180);
  return c;
}

/* Open the word's image card in a modal (used by the home word ticker). Shows
   the rendered card with the same Share / Download actions as everywhere else. */
function openCard(slug, source){
  const w=WORDS_BY_SLUG[slug]; if(!w) return;
  const url=renderCardCanvas(w).toDataURL("image/png");
  openModal(`<span class="eyebrow">Image card</span>
    <h3 style="margin:8px 0 10px">${esc(w.word)} <span style="font-family:var(--font-mono);font-size:9px;color:var(--amber-dim)">${esc(w.language.toUpperCase())}</span></h3>
    <img class="card-preview" src="${url}" alt="Image card for ${esc(w.word)} — ${esc(w.defShort)}">
    <div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap">
      <button class="btn btn-amber" style="flex:1" onclick="BABELAPP.shareCardTo('${w.slug}','${source||"ticker"}')">Share Card ↗</button>
      <button class="btn btn-ghost" style="flex:1" onclick="BABELAPP.shareCard('${w.slug}','${source||"ticker"}')">Download ⬇</button>
      <a class="btn btn-ghost" href="#/word/${w.slug}" onclick="BABELAPP.closeModal()">Open portrait →</a>
    </div>`);
}

// Download the card as a PNG (the original "Download Image Card" action).
function shareCard(slug, source, opts={}){
  const w=WORDS_BY_SLUG[slug];
  const url=renderCardCanvas(w).toDataURL("image/png");
  const a=document.createElement("a"); a.href=url; a.download=`babel-${slug}.png`; a.click();
  API.track("share",{slug, type:"image_card"});
  if(API.currentUser()) API.saveCard(slug, source||"portrait");
  if(!opts.silent){
    toast(API.currentUser() ? "Image card downloaded — saved to your account" : "Image card downloaded");
  }
}

/* Share the image card straight to social apps — no download step.
   On devices that support the Web Share API with files (most phones, some
   desktops), this hands the actual PNG to the native share sheet, so it can
   go directly to WhatsApp, Instagram, Messages, X, etc. Where that isn't
   available, we fall back to a share menu of the popular platforms (sharing
   the word + secure link) plus copy-image / download options. Either path
   logs a share_card event for the admin metrics. */
function cardShareText(w){
  return `“${w.word}” (${w.language}) — ${w.defShort} · an untranslatable word from Babel.`;
}
async function shareCardTo(slug, source){
  const w=WORDS_BY_SLUG[slug]; if(!w) return;
  const canvas=renderCardCanvas(w);
  const shareUrl=SITE_URL+"/#/word/"+slug;
  const text=cardShareText(w);
  const blob=await new Promise(res=>canvas.toBlob(res, "image/png"));
  const file=blob ? new File([blob], `babel-${slug}.png`, {type:"image/png"}) : null;

  // 1) Native share sheet WITH the image file — the real "share to any app" path.
  if(file && navigator.canShare && navigator.canShare({files:[file]})){
    try{
      await navigator.share({ files:[file], title:`Babel · ${w.word}`, text, url:shareUrl });
      recordCardShare(slug, source, "native");
      return;
    }catch(e){ if(e && e.name==="AbortError") return; /* user dismissed */ }
  }
  // 2) Fallback: a menu of popular social apps (+ copy image / download).
  openShareMenu(slug, source, {w, shareUrl, text, blob});
}
function recordCardShare(slug, source, via){
  API.track("share_card", {slug, via});
  if(API.currentUser()) API.saveCard(slug, source||"portrait");
}
// Image-first apps with no web pre-fill URL — you post a picture, so we hand over
// the image (download) and open the app to upload it.
const SHARE_APP_URLS = {
  instagram:"https://www.instagram.com/",
  snapchat:"https://www.snapchat.com/",
  tiktok:"https://www.tiktok.com/upload",
  discord:"https://discord.com/channels/@me",
};
function openShareMenu(slug, source, ctx){
  const {w, shareUrl, text} = ctx;
  const u=encodeURIComponent(shareUrl), t=encodeURIComponent(text), tu=encodeURIComponent(text+" "+shareUrl);
  // Platforms that accept a pre-filled web share (link + caption) → open directly.
  const intents=[
    ["WhatsApp",  `https://api.whatsapp.com/send?text=${tu}`],
    ["X / Twitter",`https://twitter.com/intent/tweet?text=${t}&url=${u}`],
    ["Facebook",  `https://www.facebook.com/sharer/sharer.php?u=${u}&quote=${t}`],
    ["Threads",   `https://www.threads.net/intent/post?text=${tu}`],
    ["Telegram",  `https://t.me/share/url?url=${u}&text=${t}`],
    ["LinkedIn",  `https://www.linkedin.com/sharing/share-offsite/?url=${u}`],
    ["Pinterest", `https://www.pinterest.com/pin/create/button/?url=${u}&description=${t}`],
    ["Tumblr",    `https://www.tumblr.com/widgets/share/tool?canonicalUrl=${u}&caption=${t}`],
    ["Reddit",    `https://www.reddit.com/submit?url=${u}&title=${t}`],
    ["Email",     `mailto:?subject=${encodeURIComponent("A word from Babel: "+w.word)}&body=${tu}`],
  ];
  // Image-first apps (upload a picture) — Instagram, Snapchat, TikTok, Discord.
  const apps=[["Instagram","instagram"],["Snapchat","snapchat"],["TikTok","tiktok"],["Discord","discord"]];
  const intentBtns=intents.map(([label,href])=>
    `<a class="btn btn-ghost share-target" href="${href}" target="_blank" rel="noopener"
        onclick="BABELAPP.markShare('${slug}','${source||"portrait"}','${label.split(' ')[0].toLowerCase()}')">${label}</a>`).join("");
  const appBtns=apps.map(([label,key])=>
    `<button class="btn btn-ghost share-target" onclick="BABELAPP.shareToApp('${slug}','${source||"portrait"}','${key}')">${label}</button>`).join("");
  openModal(`<span class="eyebrow">Share “${esc(w.word)}”</span>
    <h3 style="margin:8px 0 4px">Share this image card</h3>
    <p style="font-size:12px;margin-bottom:14px">Send it straight to an app — no download needed. On phones the actual image is shared; on desktop the link + caption open in your chosen app.</p>
    <div class="share-targets">${intentBtns}</div>
    <p class="label label-line" style="margin:16px 0 6px">Image-first apps</p>
    <p style="font-size:11px;color:var(--text-faint);margin-bottom:8px">These post a picture — we'll hand you the image and open the app so you can upload it.</p>
    <div class="share-targets">${appBtns}</div>
    <div style="display:flex;gap:8px;margin-top:16px;flex-wrap:wrap">
      <button class="btn btn-amber" style="flex:1" onclick="BABELAPP.copyCardImage('${slug}','${source||"portrait"}')">Copy image</button>
      <button class="btn btn-ghost" style="flex:1" onclick="BABELAPP.closeModal();BABELAPP.shareCard('${slug}','${source||"portrait"}')">Download image</button>
    </div>`);
}
// Hand the image to an image-first app: download the PNG, open the app, log the share.
function shareToApp(slug, source, key){
  const label=key.charAt(0).toUpperCase()+key.slice(1);
  shareCard(slug, source, {silent:true});                 // downloads the PNG (also saves card)
  window.open(SHARE_APP_URLS[key]||SITE_URL, "_blank", "noopener");
  recordCardShare(slug, source, key);
  toast(`Image saved — upload it in ${label}`);
}
async function copyCardImage(slug, source){
  const w=WORDS_BY_SLUG[slug]; if(!w) return;
  try{
    const blob=await new Promise(res=>renderCardCanvas(w).toBlob(res,"image/png"));
    await navigator.clipboard.write([new ClipboardItem({"image/png":blob})]);
    recordCardShare(slug, source, "copy-image");
    toast("Image copied — paste it into any app");
  }catch(e){ toast("Couldn't copy the image — use Download instead"); }
}
function wrapText(ctx,text,x,y,maxW,lh){
  const words=text.split(" "); let line="";
  for(const wd of words){ const test=line+wd+" "; if(ctx.measureText(test).width>maxW && line){ ctx.fillText(line,x,y); line=wd+" "; y+=lh; } else line=test; }
  ctx.fillText(line,x,y);
}

/* ============================================================
   Router
   ============================================================ */
function render(){
  const hash=location.hash||"#/";
  renderNav();
  window.scrollTo(0,0);
  if(hash.startsWith("#/word/")){ app.innerHTML=pageWord(hash.split("/")[2]); }
  else switch(hash.split("?")[0]){
    case "#/": app.innerHTML=pageHome(); break;
    case "#/atlas": app.innerHTML=pageAtlas(); renderAtlasGrid(); break;
    case "#/name-my-feeling": {
      const params=new URLSearchParams(hash.split("?")[1]||"");
      app.innerHTML=pageNMF(params.get("q")); break;
    }
    case "#/map": app.innerHTML=pageMap(); setTimeout(initMap,30); break;
    case "#/theory": app.innerHTML=pageTheory(); setTimeout(initTheory,30); break;
    case "#/compose": app.innerHTML=pageCompose(); renderComposeEditor(); updateComposeStat(); break;
    case "#/about": app.innerHTML=pageAbout(); setTimeout(initAbout,30); break;
    case "#/account": app.innerHTML=pageAccount(); setTimeout(initAccount,30); break;
    case "#/sources": app.innerHTML=pageSources(); setTimeout(initSources,30); break;
    case "#/admin": app.innerHTML=pageAdmin(); setTimeout(initAdmin,30); break;
    default: app.innerHTML=pageHome();
  }
}

/* ============================================================
   Public actions (referenced from inline handlers)
   ============================================================ */
window.BABELAPP={
  openAuth, doAuth, logout, closeModal,
  heroSearch(){ const v=$("#heroSearch").value.trim(); location.hash="#/name-my-feeling"+(v?"?q="+encodeURIComponent(v):""); },
  // Atlas
  atlasSearch(v){ atlasState.q=v; atlasState.page=1; renderAtlasGrid();
    const box=$("#instant"); const res=TRIE.search(v);
    box.innerHTML = v && res.length ? `<div class="instant-results">${res.map(w=>`<div class="instant-row" onclick="location.hash='#/word/${w.slug}'"><span class="iw">${esc(w.word)}</span><span class="il">${esc(w.language)} · ${w.dist}%</span></div>`).join("")}</div>`:""; },
  atlasSort(v){ atlasState.sort=v; renderAtlasGrid(); },
  atlasFamily(f){ atlasState.family=f; atlasState.page=1; render(); renderAtlasGrid(); },
  atlasCat(c){ atlasState.category=c; atlasState.page=1; render(); renderAtlasGrid(); },
  atlasBand(b){ atlasState.band=b; atlasState.page=1; render(); renderAtlasGrid(); },
  atlasScript(s){ atlasState.script=s; atlasState.page=1; render(); renderAtlasGrid(); },
  atlasMore(){ atlasState.page++; renderAtlasGrid(); },
  // Word portrait
  async toggleSave(slug,btn){ const u=API.currentUser(); if(!u){ openAuth(); return; }
    const r=await API.toggleSave(slug); btn.classList.toggle("saved",r.saved); btn.textContent=r.saved?"★":"☆"; toast(r.saved?"Saved to your collection":"Removed"); },
  askBabel, shareCard, shareCardTo, copyCardImage, shareToApp, openCard, speak,
  markShare(slug, source, via){ recordCardShare(slug, source, via); toast("Opening share…"); },
  // NMF
  nmfExample(el){ $("#nmfInput").value=el.textContent; $("#nmfCount").textContent=el.textContent.length; },
  nmfSearch,
  // Map
  mapMode(m){ mapState.mode=m;
    $$(".mode-toggle .tag[data-mode]").forEach(t=>t.classList.toggle("active", t.dataset.mode===m));
    if(mapSim) mapSim.morph(); else setTimeout(initMap,30);   // morph smoothly to the new layout
  },
  mapColor(v){ mapState.colorBy=v; if(mapSim) mapSim.restyle(); },
  mapFilter(c){ mapState.filterCat=c; if(mapSim) mapSim.restyle(); },
  mapZoom(f){ if(mapSim) mapSim.zoom(f); },
  // Theory
  boroditsky,
  wordPopup(e,slug){ const w=WORDS_BY_SLUG[slug]; showPopup(e,`<div class="pl">${esc(w.language)}</div><div class="pw">${esc(w.word)}</div><div class="pd">${esc(w.defShort)}</div><div class="ir-dist">${w.dist}% distance →</div>`); },
  hidePopup(){ const p=$("#popup"); if(p) p.style.display="none"; },
  // Composer
  composeTab(t){ composeState.tab=t; render(); },
  async composeAnalyse(){ if(!composeState.text.trim()){ toast("Write something first"); return; }
    let found;
    try{ found=(await apiFetch("/compose/analyse", {method:"POST", body:JSON.stringify({text:composeState.text})})).found; }
    catch(e){ found=analyseText(composeState.text); }
    composeState.found=found; composeState.tab="annotated"; render(); renderPalette(); toast(`${composeState.found.length} untranslatable moments found`); },
  composePopup(e,i){ const f=composeState.found[i]; showPopup(e,`<div class="pl">${esc(f.lang)}</div><div class="pw">${esc(f.word)}</div><div class="pd">${esc(f.def)}</div><div class="pwhy">${f.why}</div>`); },
  composeCopy(){ navigator.clipboard.writeText(composeState.text).then(()=>toast("Copied to clipboard")); },
  composeShare(){
    const found = composeState.found || [];
    if(!found.length){ toast("Analyse your text first"); return; }
    // Download an image card for every untranslatable word found in the composition.
    found.forEach((f, i)=> setTimeout(()=> shareCard(f.slug, 'compose', {silent:true}), i*350));
    toast(`Downloading ${found.length} image card${found.length>1?'s':''}…`);
  },
  // About
  async submitWord(){ const word=$("#subWord").value.trim(), language=$("#subLang").value.trim(), why=$("#subWhy").value.trim();
    if(!word||!language||!why){ toast("Fill word, language and why"); return; }
    const status=$("#subStatus"); status.textContent="Checking against the atlas…";
    const r=await API.submit({word,language,why,submitter:$("#subName").value.trim(),email:$("#subEmail").value.trim()});
    if(!r.ok){ status.innerHTML=`<span style="color:var(--amber-light)">Not queued — ${esc(r.error)}</span>`; toast("Submission needs a fix"); return; }
    $("#subWord").value=$("#subLang").value=$("#subWhy").value="";
    const flagNote = r.flagged ? " (flagged for a closer look — brief explanation)" : "";
    status.textContent=`Thank you — screened for duplicates and queued for review${flagNote}. ${r.queued} awaiting review.`;
    toast(r.offline ? "Submitted (offline — not screened)" : "Submitted for review"); },
  // Account
  async unsaveCard(slug){ await API.unsaveCard(slug); toast("Removed"); initAccount(); },
  editAccount(){
    const u = API.currentUser(); if(!u) return;
    openModal(`<span class="eyebrow">Your profile</span>
      <h3 style="margin:8px 0 4px">Edit account</h3>
      <p style="font-size:12px;margin-bottom:16px">Update your name, or set a new password. Leave the password blank to keep it unchanged.</p>
      <div class="form-field"><label>Name</label><input id="editName" type="text" value="${esc(u.name||"")}" placeholder="Your name"></div>
      <div class="form-field"><label>New password (optional)</label><input id="editPass" type="password" placeholder="••••••••" autocomplete="new-password"></div>
      <button class="btn btn-amber btn-full" id="editSubmitBtn" onclick="BABELAPP.saveAccount()">Save changes</button>`);
  },
  async saveAccount(){
    const name = ($("#editName").value||"").trim();
    const pass = $("#editPass").value||"";
    if(!name){ toast("Name can't be empty"); return; }
    const patch = {name}; if(pass) patch.password = pass;
    const btn=$("#editSubmitBtn"); if(btn) btn.textContent="Saving…";
    const r = await API.updateAccount(patch);
    if(!r.ok){ toast(r.error); if(btn) btn.textContent="Save changes"; return; }
    closeModal(); renderNav(); toast("Account updated"); render();
  },
  deleteAccount(){
    openModal(`<span class="eyebrow" style="color:#C77D5A">Danger zone</span>
      <h3 style="margin:8px 0 4px">Delete your account?</h3>
      <p style="font-size:12px;margin-bottom:16px">This permanently removes your account, saved words, saved image cards, and search history. This can't be undone.</p>
      <div style="display:flex;gap:8px">
        <button class="btn btn-ghost btn-full" onclick="BABELAPP.closeModal()">Cancel</button>
        <button class="btn btn-full" style="background:#C77D5A;color:#07060E;border:none" onclick="BABELAPP.confirmDeleteAccount()">Delete permanently</button>
      </div>`);
  },
  async confirmDeleteAccount(){
    const r = await API.deleteAccount();
    closeModal(); renderNav();
    if(!r.ok){ toast(r.error||"Couldn't delete account"); return; }
    location.hash="#/"; toast("Account deleted"); render();
  },
  // Admin
  adminLogin, adminAction,
  adminLogout(){ sessionStorage.removeItem("babel:adminKey"); renderNav(); toast("Signed out of admin"); render(); },
};

function renderPalette(){
  const el=$("#palette"); if(!el) return;
  $("#foundCount").textContent=`(${composeState.found.length})`;
  el.innerHTML = composeState.found.length ? composeState.found.map(f=>`<div class="palette-card">
    <span class="wc-meta">${esc(f.lang)}</span>
    <div class="wc-word" style="font-size:1.3rem">${esc(f.word)}</div>
    <div class="wc-def" style="min-height:auto">${esc(f.def)}</div>
    <div class="quote">“${esc(f.phrase.slice(0,80))}${f.phrase.length>80?"…":""}”</div>
    <a class="wc-open" style="opacity:1" href="#/word/${f.slug}">Open portrait →</a>
  </div>`).join("") : `<p style="font-size:12px">No untranslatable moments found — try writing something more emotional.</p>`;
  updateComposeStat();
}

/* Shared popup (theory + composer) */
function showPopup(e,html){
  let p=$("#popup"); if(!p){ p=document.createElement("div"); p.id="popup"; p.className="popup"; document.body.appendChild(p); }
  p.innerHTML=html; p.style.display="block";
  const px=Math.min(e.clientX+12, window.innerWidth-280), py=Math.min(e.clientY+12, window.innerHeight-160);
  p.style.left=px+"px"; p.style.top=py+"px";
}

/* NMF live char count (delegated) */
document.addEventListener("input",e=>{ if(e.target && e.target.id==="nmfInput"){ const c=$("#nmfCount"); if(c) c.textContent=e.target.value.length; } });

/* Boot */
window.addEventListener("hashchange",render);
render();
hydrateWordsFromBackend();
})();
