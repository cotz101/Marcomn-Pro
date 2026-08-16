const SENTENCE_BOUNDARY_WINDOW = 60;
const COMMON_ABBREVIATIONS = new Set([
  'dr', 'jr', 'mr', 'mrs', 'ms', 'prof', 'sr', 'st', 'vs',
]);

export const getWordAwareTruncationLength = (text, limit) => {
  if (!text || limit <= 0) return 0;
  if (text.length <= limit) return text.length;

  const cutoff = Math.min(limit, text.length);
  const cutoffTouchesWhitespace = /\s/u.test(text[cutoff - 1]) || /\s/u.test(text[cutoff]);

  if (cutoffTouchesWhitespace) {
    return text.slice(0, cutoff).trimEnd().length;
  }

  for (let index = cutoff - 1; index >= 0; index -= 1) {
    if (/\s/u.test(text[index])) {
      return text.slice(0, index).trimEnd().length;
    }
  }

  // Avoid returning a fragment when the preview begins with one oversized token.
  return 0;
};

const isLikelyAbbreviation = (text, punctuationIndex) => {
  const precedingWord = text.slice(0, punctuationIndex).match(/[\p{L}]+$/u)?.[0] || '';
  return precedingWord.length === 1 || COMMON_ABBREVIATIONS.has(precedingWord.toLowerCase());
};

export const getNaturalTruncationLength = (
  text,
  limit,
  sentenceWindow = SENTENCE_BOUNDARY_WINDOW,
) => {
  if (!text || limit <= 0) return 0;
  if (text.length <= limit) return text.length;

  const minimum = Math.max(0, limit - sentenceWindow);
  const maximum = Math.min(text.length - 1, limit + sentenceWindow);
  const candidates = [];

  for (let index = minimum; index <= maximum; index += 1) {
    const character = text[index];
    if (!/[.!?]/u.test(character) || !/\s/u.test(text[index + 1])) continue;
    if (character === '.' && isLikelyAbbreviation(text, index)) continue;

    const boundary = index + 1;
    if (!text.slice(boundary).trim()) continue;
    candidates.push(boundary);
  }

  if (candidates.length > 0) {
    return candidates.reduce((best, candidate) => {
      const candidateDistance = Math.abs(candidate - limit);
      const bestDistance = Math.abs(best - limit);
      return candidateDistance < bestDistance
        || (candidateDistance === bestDistance && candidate > best)
        ? candidate
        : best;
    });
  }

  return getWordAwareTruncationLength(text, limit);
};
