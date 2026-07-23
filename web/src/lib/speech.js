// Pronunciation via the Web Speech API (no external dependency, works offline).
// Speaks the native script ONLY when a matching voice is actually installed;
// otherwise it speaks the romanized headword with the default voice. Forcing an
// unavailable locale — or handing a non-Latin native script to an English voice —
// makes the browser produce no sound at all, which is why many non-European words
// had gone silent. This keeps every word pronounceable regardless of its origin.
const LANG_LOCALE = {
  Japanese: "ja-JP", "Mandarin Chinese": "zh-CN", Mandarin: "zh-CN", Chinese: "zh-CN",
  Cantonese: "zh-HK", Korean: "ko-KR",
  German: "de-DE", French: "fr-FR", Spanish: "es-ES", Portuguese: "pt-PT",
  "Portuguese (Brazil)": "pt-BR", Italian: "it-IT", Dutch: "nl-NL", Catalan: "ca-ES",
  Galician: "gl-ES", Occitan: "oc-FR", Romanian: "ro-RO", Latin: "la",
  Swedish: "sv-SE", Norwegian: "nb-NO", Danish: "da-DK", Finnish: "fi-FI",
  Icelandic: "is-IS", Estonian: "et-EE", Latvian: "lv-LV", Lithuanian: "lt-LT",
  Russian: "ru-RU", Ukrainian: "uk-UA", Polish: "pl-PL", Czech: "cs-CZ",
  Serbian: "sr-RS", Croatian: "hr-HR", Slovenian: "sl-SI", Greek: "el-GR",
  Turkish: "tr-TR", Azerbaijani: "az-AZ", Kazakh: "kk-KZ", Mongolian: "mn-MN",
  Hungarian: "hu-HU", Albanian: "sq-AL", Armenian: "hy-AM", Georgian: "ka-GE",
  Arabic: "ar-SA", Hebrew: "he-IL", Persian: "fa-IR", Pashto: "ps-AF", Kurdish: "ckb",
  Urdu: "ur-PK", Hindi: "hi-IN", Sanskrit: "hi-IN", Bengali: "bn-IN", Punjabi: "pa-IN",
  Marathi: "mr-IN", Gujarati: "gu-IN", Nepali: "ne-NP", Sinhala: "si-LK",
  Tamil: "ta-IN", Telugu: "te-IN", Malayalam: "ml-IN", Kannada: "kn-IN",
  Thai: "th-TH", Khmer: "km-KH", Burmese: "my-MM", Vietnamese: "vi-VN",
  Indonesian: "id-ID", Malay: "ms-MY", Tagalog: "fil-PH", Javanese: "jv-ID",
  Sundanese: "su-ID", Welsh: "cy-GB", Irish: "ga-IE", "Scottish Gaelic": "gd-GB",
  Basque: "eu-ES", Maltese: "mt-MT", Afrikaans: "af-ZA", Swahili: "sw-KE",
  Zulu: "zu-ZA", "Zulu / Nguni": "zu-ZA", Xhosa: "xh-ZA", Yoruba: "yo-NG",
  Igbo: "ig-NG", Hausa: "ha-NG", Amharic: "am-ET", Somali: "so-SO",
  Shona: "sn-ZW", Sesotho: "st-ZA", Chichewa: "ny-MW", Kinyarwanda: "rw-RW",
  Malagasy: "mg-MG", Māori: "mi-NZ", Samoan: "sm-WS", Hawaiian: "haw",
  "Haitian Creole": "ht-HT",
};

let _voices = [];
function loadVoices() {
  try { _voices = window.speechSynthesis ? window.speechSynthesis.getVoices() : []; }
  catch (e) { _voices = []; }
}
if (typeof window !== "undefined" && window.speechSynthesis) {
  loadVoices();
  // Voice lists often populate asynchronously; refresh the cache when they arrive.
  try { window.speechSynthesis.addEventListener("voiceschanged", loadVoices); }
  catch (e) { window.speechSynthesis.onvoiceschanged = loadVoices; }
}

export function speak(word) {
  try {
    if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) return;
    if (!_voices.length) loadVoices(); // handle late-arriving voices

    const code = LANG_LOCALE[word.language];
    const prefix = code ? code.slice(0, 2).toLowerCase() : "";
    // A voice we can actually use for this language (match on the language subtag).
    const voice = prefix
      ? _voices.find((v) => v.lang && v.lang.toLowerCase().startsWith(prefix))
      : null;

    // Native script only if a matching voice can read it; otherwise the romanized
    // headword, which any default voice can attempt — so it is never silent.
    const text = (voice && word.native) ? word.native : (word.word || word.native || "");
    if (!text) return;

    const u = new SpeechSynthesisUtterance(text);
    if (voice) {
      u.voice = voice;
      u.lang = voice.lang || code;
    }
    // No voice: leave u.lang unset so the default system voice speaks the romanized form.
    u.rate = 0.85;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  } catch (e) {
    /* ignore */
  }
}
