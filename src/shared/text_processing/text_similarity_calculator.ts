/**
 * Text similarity calculation utilities
 * Uses Levenshtein distance algorithm for string comparison
 */

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;

  // Create a 2D array to store distances
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  // Initialize first row and column
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  // Fill the rest of the matrix
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(
          dp[i - 1][j],     // deletion
          dp[i][j - 1],     // insertion
          dp[i - 1][j - 1]  // substitution
        );
      }
    }
  }

  return dp[m][n];
}

/**
 * Calculate similarity ratio between two strings (0 to 1)
 */
export function calculateSimilarity(str1: string, str2: string): number {
  if (str1 === str2) return 1;
  if (!str1 || !str2) return 0;

  const normalizedStr1 = str1.toLowerCase().trim();
  const normalizedStr2 = str2.toLowerCase().trim();

  if (normalizedStr1 === normalizedStr2) return 1;

  const distance = levenshteinDistance(normalizedStr1, normalizedStr2);
  const maxLength = Math.max(normalizedStr1.length, normalizedStr2.length);

  return 1 - distance / maxLength;
}

/**
 * Find similar texts from a list
 */
export function findSimilarTexts(
  target: string,
  candidates: { id: string; text: string }[],
  threshold: number = 0.8
): { id: string; text: string; similarity: number }[] {
  const results = candidates
    .map((candidate) => ({
      ...candidate,
      similarity: calculateSimilarity(target, candidate.text),
    }))
    .filter((result) => result.similarity >= threshold)
    .sort((a, b) => b.similarity - a.similarity);

  return results;
}

/**
 * Check if two texts are exact match (case-insensitive, trimmed)
 */
export function isExactMatch(str1: string, str2: string): boolean {
  return str1.toLowerCase().trim() === str2.toLowerCase().trim();
}
