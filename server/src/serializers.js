/* Allow-list serializers: every response built from a stored record goes
   through one of these, so a new database column is never exposed by accident. */

function serializeWord(w) {
  return {
    slug: w.slug,
    number: w.number,
    word: w.word,
    language: w.language,
    native: w.native,
    phonetic: w.phonetic,
    family: w.family,
    script: w.script,
    dist: w.distScore,
    intensity: w.intensity,
    category: w.category,
    defShort: w.defShort,
    defFull: w.defFull,
    dimensions: (w.dimensions || []).map((d) => ({ label: d.label, content: d.content })),
    cultures: (w.cultures || []).map((c) => ({ name: c.name, content: c.content })),
    comparisons: (w.comparisons || []).map((c) => ({ lang: c.lang, word: c.comparisonWord, sim: c.similarity })),
    related: (w.related || []).map((r) => r.relatedSlug),
  };
}

const serializeAccount = (u) => ({ email: u.email, name: u.name });
const serializeProfile = (u) => ({ email: u.email, name: u.name, createdAt: u.createdAt });

// The moderation queue needs the entry and who sent it, not their email.
function serializeSubmissionForAdmin(s) {
  return { id: s.id, word: s.word, language: s.language, why: s.why, submitter: s.submitter, status: s.status, statusNote: s.statusNote, submittedAt: s.submittedAt };
}

module.exports = { serializeWord, serializeAccount, serializeProfile, serializeSubmissionForAdmin };
