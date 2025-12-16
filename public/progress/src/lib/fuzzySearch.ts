/**
 * Fuzzy Search Utility
 * Provides flexible string matching for exercise search
 */

export interface FuzzyResult<T> {
  item: T;
  score: number;
  matches: Array<{ start: number; end: number }>;
}

/**
 * Calculate fuzzy match score between query and target string
 * Returns score 0-1 (higher is better match) and match positions
 */
export function fuzzyMatch(
  query: string,
  target: string
): { score: number; matches: Array<{ start: number; end: number }> } | null {
  const q = query.toLowerCase();
  const t = target.toLowerCase();

  // Empty query matches everything
  if (!q) return { score: 1, matches: [] };

  // Exact match gets highest score
  if (t === q) return { score: 1, matches: [{ start: 0, end: t.length }] };

  // Contains match - high score
  const containsIdx = t.indexOf(q);
  if (containsIdx !== -1) {
    // Bonus for matching at start
    const startBonus = containsIdx === 0 ? 0.1 : 0;
    // Bonus for matching whole word
    const wordBoundaryBefore = containsIdx === 0 || /\s/.test(t[containsIdx - 1]);
    const wordBoundaryAfter =
      containsIdx + q.length === t.length || /\s/.test(t[containsIdx + q.length]);
    const wordBonus = wordBoundaryBefore && wordBoundaryAfter ? 0.1 : 0;

    return {
      score: 0.8 + startBonus + wordBonus,
      matches: [{ start: containsIdx, end: containsIdx + q.length }],
    };
  }

  // Word-based matching - search matches words
  const queryWords = q.split(/\s+/).filter(Boolean);
  const targetWords = t.split(/\s+/);
  
  if (queryWords.length > 1) {
    let matchedWords = 0;
    const matches: Array<{ start: number; end: number }> = [];
    let currentPos = 0;

    for (const qWord of queryWords) {
      let wordPos = 0;
      for (const tWord of targetWords) {
        const wordStart = t.indexOf(tWord, currentPos);
        if (tWord.includes(qWord)) {
          const matchStart = wordStart + tWord.indexOf(qWord);
          matches.push({ start: matchStart, end: matchStart + qWord.length });
          matchedWords++;
          break;
        }
        wordPos++;
      }
    }

    if (matchedWords === queryWords.length) {
      return { score: 0.7 + (matchedWords / queryWords.length) * 0.1, matches };
    }
  }

  // Character-by-character fuzzy matching
  let qi = 0;
  let ti = 0;
  const matches: Array<{ start: number; end: number }> = [];
  let consecutiveMatches = 0;
  let maxConsecutive = 0;
  let lastMatchIdx = -2;

  while (qi < q.length && ti < t.length) {
    if (q[qi] === t[ti]) {
      if (lastMatchIdx === ti - 1) {
        // Extend current match
        matches[matches.length - 1].end = ti + 1;
        consecutiveMatches++;
        maxConsecutive = Math.max(maxConsecutive, consecutiveMatches);
      } else {
        // Start new match
        matches.push({ start: ti, end: ti + 1 });
        consecutiveMatches = 1;
      }
      lastMatchIdx = ti;
      qi++;
    }
    ti++;
  }

  // All query characters must be found
  if (qi < q.length) return null;

  // Score based on:
  // - Ratio of matched to total characters
  // - Consecutive matches bonus
  // - Position bonus (earlier is better)
  const matchRatio = q.length / t.length;
  const consecutiveBonus = maxConsecutive / q.length;
  const positionBonus = matches.length ? 1 - matches[0].start / t.length : 0;

  const score = Math.min(
    0.6,
    matchRatio * 0.3 + consecutiveBonus * 0.2 + positionBonus * 0.1
  );

  return { score, matches };
}

/**
 * Search a list of items with fuzzy matching
 */
export function fuzzySearch<T>(
  items: T[],
  query: string,
  getSearchText: (item: T) => string,
  options?: {
    minScore?: number;
    maxResults?: number;
  }
): FuzzyResult<T>[] {
  const { minScore = 0.1, maxResults = 200 } = options || {};

  if (!query.trim()) {
    return items.slice(0, maxResults).map((item) => ({
      item,
      score: 1,
      matches: [],
    }));
  }

  const results: FuzzyResult<T>[] = [];

  for (const item of items) {
    const text = getSearchText(item);
    const result = fuzzyMatch(query, text);

    if (result && result.score >= minScore) {
      results.push({
        item,
        score: result.score,
        matches: result.matches,
      });
    }
  }

  // Sort by score descending
  results.sort((a, b) => b.score - a.score);

  return results.slice(0, maxResults);
}

/**
 * Highlight matched portions of text with spans
 */
export function highlightMatches(
  text: string,
  matches: Array<{ start: number; end: number }>
): Array<{ text: string; highlight: boolean }> {
  if (!matches.length) return [{ text, highlight: false }];

  const parts: Array<{ text: string; highlight: boolean }> = [];
  let lastEnd = 0;

  // Sort matches by start position
  const sorted = [...matches].sort((a, b) => a.start - b.start);

  for (const match of sorted) {
    // Add non-matched portion before this match
    if (match.start > lastEnd) {
      parts.push({ text: text.slice(lastEnd, match.start), highlight: false });
    }
    // Add matched portion
    parts.push({ text: text.slice(match.start, match.end), highlight: true });
    lastEnd = match.end;
  }

  // Add remaining text after last match
  if (lastEnd < text.length) {
    parts.push({ text: text.slice(lastEnd), highlight: false });
  }

  return parts;
}
