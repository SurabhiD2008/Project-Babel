/* Every request body, query string and path parameter the API accepts. Write
   bodies are strict: an unknown field is a refusal, not something to ignore. */
const { z } = require("zod");
const { CATEGORY_NAMES } = require("./ai");

const CATEGORY_KEYS = Object.keys(CATEGORY_NAMES);
const CLIENT_EVENTS = ["share", "share_card", "ask_babel"];
const CARD_SOURCES = ["portrait", "feeling", "compose"];
const SUBMISSION_STATUSES = ["pending", "flagged", "accepted", "rejected_invalid", "rejected_duplicate", "rejected_ambiguous", "rejected_inaccurate"];

// bcrypt reads at most 72 bytes; a longer password would be silently truncated.
const PASSWORD_MAX_BYTES = 72;
const newPassword = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .refine((p) => Buffer.byteLength(p, "utf8") <= PASSWORD_MAX_BYTES, "Password must be at most 72 bytes.");

const slug = z.string().regex(/^[a-z0-9-]{1,80}$/, "Invalid word id.");
const name = z.string().trim().min(1, "Please enter your name.").max(80, "Name must be at most 80 characters.");

const bodies = {
  feeling: z.strictObject({ input: z.string().trim().min(4, "Describe the feeling a little more.").max(1000, "Keep the description under 1,000 characters.") }),
  compose: z.strictObject({ text: z.string().trim().min(8, "Write a little more to analyse.").max(10000, "Keep the text under 10,000 characters.") }),
  submission: z.strictObject({
    word: z.string().trim().min(1, "Word is required.").max(60, "The word must be at most 60 characters."),
    language: z.string().trim().min(2, "Language is required.").max(40, "The language name must be at most 40 characters."),
    why: z.string().trim().min(15, "The explanation is too short to judge.").max(2000, "Keep the explanation under 2,000 characters."),
    submitter: z.string().trim().max(80, "Name must be at most 80 characters.").optional().default(""),
    email: z.union([z.literal(""), z.email("Please enter a valid email address.").max(254)]).optional().default(""),
  }),
  register: z.strictObject({
    name,
    email: z.email("Please enter a valid email address.").max(254).transform((e) => e.toLowerCase()),
    password: newPassword,
  }),
  login: z.strictObject({
    email: z.string().trim().max(254).transform((e) => e.toLowerCase()),
    password: z.string().min(1).max(1024),
  }),
  updateMe: z
    .strictObject({ name: name.optional(), password: newPassword.optional(), currentPassword: z.string().max(1024).optional() })
    .refine((b) => b.name !== undefined || b.password !== undefined, "Nothing to update.")
    .refine((b) => b.password === undefined || !!b.currentPassword, "Enter your current password to set a new one."),
  saveCard: z.strictObject({ source: z.enum(CARD_SOURCES).optional().default("portrait") }),
  empty: z.strictObject({}),
  event: z.strictObject({ event: z.enum(CLIENT_EVENTS), slug: z.union([z.literal(""), slug]).optional().default("") }),
};

const band = z
  .string()
  .regex(/^\d{1,3}-\d{1,3}$/, "band must look like 60-80.")
  .transform((b) => b.split("-").map(Number))
  .refine(([lo, hi]) => lo <= hi && hi <= 100, "band must be within 0-100.");

const queries = {
  words: z.object({
    q: z.string().max(100).optional(),
    family: z.string().max(60).optional(),
    category: z.enum(CATEGORY_KEYS).optional(),
    script: z.string().max(30).optional(),
    band: band.optional(),
    sort: z.enum(["dist", "az", "num", "intensity"]).optional().default("dist"),
    page: z.coerce.number().int().min(1).max(10000).optional().default(1),
    per: z.coerce.number().int().min(1).max(100).optional().default(20),
  }),
  random: z.object({ daily: z.enum(["true", "false"]).optional() }),
  adminSubmissions: z.object({ status: z.enum(SUBMISSION_STATUSES).optional() }),
};

const params = {
  slug: z.object({ slug }),
  adminAction: z.object({ id: z.coerce.number().int().positive(), action: z.enum(["accept", "reject"]) }),
};

/* Express middleware: validates one part of the request and replaces it with
   the parsed value. Submissions answer 422 because the client shows that body. */
function validate(part, schema, status = 400) {
  return (req, res, next) => {
    const result = schema.safeParse(part === "body" ? req.body ?? {} : req[part]);
    if (!result.success) return res.status(status).json({ error: result.error.issues[0].message });
    if (part === "query") Object.defineProperty(req, "query", { value: result.data, writable: true });
    else req[part] = result.data;
    next();
  };
}

module.exports = { bodies, queries, params, validate, CLIENT_EVENTS, PASSWORD_MAX_BYTES };
