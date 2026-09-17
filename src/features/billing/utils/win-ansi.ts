const WIN_ANSI_REPLACEMENTS: Record<string, string> = {
  "\u2014": "-",
  "\u2013": "-",
  "\u2018": "'",
  "\u2019": "'",
  "\u201C": '"',
  "\u201D": '"',
  "\u2026": "...",
  "\u00A0": " ",
  "\u2022": "-",
};

/**
 * Helvetica de pdf-lib usa WinAnsi. Reemplaza caracteres Unicode
 * que harían fallar drawText (em dash, comillas tipográficas, etc.).
 */
export function toWinAnsi(value: string): string {
  let output = "";

  for (const character of value) {
    const replacement = WIN_ANSI_REPLACEMENTS[character];
    if (replacement) {
      output += replacement;
      continue;
    }

    const code = character.charCodeAt(0);
    if (code <= 255) {
      output += character;
      continue;
    }

    output += "?";
  }

  return output;
}
