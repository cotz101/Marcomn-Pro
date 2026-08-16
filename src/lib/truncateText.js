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
