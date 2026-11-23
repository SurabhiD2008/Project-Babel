/* An in-memory stand-in for the Prisma client, covering the subset of the
   query API the server uses. Unique constraints raise P2002 like Postgres, so
   race and duplicate handling is exercised for real. */

const UNIQUE = {
  word: [["slug"]],
  user: [["email"]],
  aiCache: [["inputHash"]],
  rateLimit: [["key"]],
  savedWord: [["userId", "wordId"]],
  savedCard: [["userId", "wordId", "source"]],
};
const DEFAULTS = {
  user: { name: "", sessionVersion: 0 },
  word: { native: "", phonetic: "", intensity: 60 },
  submission: { submitter: "", email: "", status: "pending", statusNote: "" },
  savedCard: { source: "portrait" },
  searchLog: { input: "", category: "", bestSlug: "" },
  aiCache: { kind: "feeling" },
};
const PRIMARY = { rateLimit: "key" };
const CASCADES = { user: ["savedWord", "savedCard", "userSearch"], word: ["savedWord", "savedCard"] };

function matchValue(actual, cond) {
  if (cond !== null && typeof cond === "object" && !(cond instanceof Date)) {
    if ("in" in cond) return cond.in.includes(actual);
    if ("not" in cond) return actual !== cond.not;
    if ("lt" in cond) return actual < cond.lt;
    if ("gte" in cond || "lte" in cond) return (cond.gte === undefined || actual >= cond.gte) && (cond.lte === undefined || actual <= cond.lte);
    if ("contains" in cond) return String(actual).toLowerCase().includes(String(cond.contains).toLowerCase());
  }
  return actual === cond;
}

function matches(row, where = {}) {
  return Object.entries(where).every(([k, cond]) => {
    if (k === "OR") return cond.some((w) => matches(row, w));
    // Compound unique keys such as userId_wordId arrive as nested objects.
    if (cond && typeof cond === "object" && k.includes("_") && !(k in row)) return matches(row, cond);
    return matchValue(row[k], cond);
  });
}

function duplicateError() {
  return Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
}

function createFakePrisma() {
  const tables = {};
  const ids = {};
  const table = (name) => (tables[name] ??= []);

  function applyUpdate(row, data) {
    for (const [k, v] of Object.entries(data)) {
      row[k] = v && typeof v === "object" && "increment" in v ? (row[k] || 0) + v.increment : v;
    }
  }

  function checkUnique(name, row, self) {
    for (const fields of UNIQUE[name] || []) {
      if (table(name).some((r) => r !== self && fields.every((f) => r[f] === row[f]))) throw duplicateError();
    }
  }

  function model(name) {
    // Applies select (top-level fields) and include (relations) like Prisma.
    const shape = (row, { select, include } = {}) => {
      if (!row) return row;
      if (select) return Object.fromEntries(Object.keys(select).filter((k) => k in row).map((k) => [k, row[k]]));
      return withRelations(row, include);
    };
    const withRelations = (row, include) => {
      if (!row || !include) return row && { ...row };
      const out = { ...row };
      if (include.word) out.word = table("word").find((w) => w.id === row.wordId);
      for (const rel of ["dimensions", "cultures", "comparisons", "related"]) if (include[rel]) out[rel] = [];
      return out;
    };
    const api = {
      async findUnique({ where, include, select }) { return shape(table(name).find((r) => matches(r, where)) || null, { include, select }); },
      async findFirst({ where }) { return table(name).find((r) => matches(r, where)) || null; },
      async findMany({ where, include, select, skip = 0, take } = {}) {
        const rows = table(name).filter((r) => matches(r, where));
        return rows.slice(skip, take === undefined ? undefined : skip + take).map((r) => shape(r, { include, select }));
      },
      async count({ where } = {}) { return table(name).filter((r) => matches(r, where)).length; },
      async create({ data }) {
        const row = { ...DEFAULTS[name], ...data };
        if (!PRIMARY[name]) row.id = ids[name] = (ids[name] || 0) + 1;
        row.createdAt ??= new Date();
        if (name === "submission") row.submittedAt ??= new Date();
        if (name === "savedWord" || name === "savedCard") row.savedAt ??= new Date();
        checkUnique(name, row, null);
        table(name).push(row);
        return { ...row };
      },
      async update({ where, data }) {
        const row = table(name).find((r) => matches(r, where));
        if (!row) throw Object.assign(new Error("Record not found"), { code: "P2025" });
        applyUpdate(row, data);
        return { ...row };
      },
      async updateMany({ where, data }) {
        const rows = table(name).filter((r) => matches(r, where));
        rows.forEach((r) => applyUpdate(r, data));
        return { count: rows.length };
      },
      async upsert({ where, create, update }) {
        const row = table(name).find((r) => matches(r, where));
        if (row) { applyUpdate(row, update); return { ...row }; }
        return api.create({ data: create });
      },
      async delete({ where }) {
        const row = table(name).find((r) => matches(r, where));
        if (!row) throw Object.assign(new Error("Record not found"), { code: "P2025" });
        await api.deleteMany({ where: { id: row.id } });
        return row;
      },
      async deleteMany({ where } = {}) {
        const gone = table(name).filter((r) => matches(r, where));
        tables[name] = table(name).filter((r) => !gone.includes(r));
        for (const child of CASCADES[name] || []) {
          const fk = `${name}Id`;
          tables[child] = table(child).filter((r) => !gone.some((g) => g.id === r[fk]));
        }
        return { count: gone.length };
      },
      async groupBy({ by, where }) {
        const groups = new Map();
        for (const r of table(name).filter((row) => matches(row, where))) {
          const k = r[by[0]];
          groups.set(k, (groups.get(k) || 0) + 1);
        }
        return [...groups].map(([k, n]) => ({ [by[0]]: k, _count: { [by[0]]: n } }));
      },
      async aggregate() {
        return { _max: { number: table(name).reduce((m, r) => Math.max(m, r.number || 0), 0) || null } };
      },
    };
    return api;
  }

  const client = { tables, $transaction: async (fn) => fn(client) };
  for (const name of ["word", "user", "savedWord", "savedCard", "userSearch", "submission", "aiCache", "searchLog", "rateLimit"]) client[name] = model(name);
  return client;
}

module.exports = { createFakePrisma };
