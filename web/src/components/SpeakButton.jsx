import { speak } from "../lib/speech.js";

export default function SpeakButton({ word, className = "" }) {
  return (
    <button
      className={"speak-btn " + className}
      title="Hear the pronunciation"
      aria-label="Hear the pronunciation of this word"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        speak(word);
      }}
    >
      🔊
    </button>
  );
}
