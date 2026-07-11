// Pronunciation via the Web Speech API (no external dependency, works offline).
// Best-effort locale so voices pronounce the native form better than default English.
const LANG_LOCALE = {
  Japanese: "ja-JP", German: "de-DE", French: "fr-FR", Spanish: "es-ES",
  Portuguese: "pt-PT", Italian: "it-IT", Dutch: "nl-NL", Swedish: "sv-SE",
  Norwegian: "nb-NO", Danish: "da-DK", Finnish: "fi-FI", Russian: "ru-RU",
  Greek: "el-GR", Turkish: "tr-TR", Arabic: "ar-SA", Hindi: "hi-IN",
  Korean: "ko-KR", Mandarin: "zh-CN", Chinese: "zh-CN", Welsh: "cy-GB",
  Polish: "pl-PL", Hungarian: "hu-HU", Romanian: "ro-RO", Hawaiian: "haw",
};

export function speak(word) {
  try {
    if (!("speechSynthesis" in window)) return;
    const text = word.native || word.word;
    const u = new SpeechSynthesisUtterance(text);
    const locale = LANG_LOCALE[word.language];
    if (locale) u.lang = locale;
    u.rate = 0.9;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  } catch (e) {
    /* ignore */
  }
}
