/**
 * Query Builder Utility
 * Creates URLSearchParams from filter objects
 */

/**
 * Builds a query string from a filters object
 * Automatically filters out null, undefined, and empty string values
 *
 * @example
 * const queryString = buildQueryString({
 *   language: 'ko',
 *   product_code: 'WEBMI',
 *   search: searchTerm
 * });
 * // Returns: "language=ko&product_code=WEBMI&search=term"
 */
export function buildQueryString(filters: Record<string, any>): string {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    // Skip null, undefined, and empty string values
    if (value !== null && value !== undefined && value !== '') {
      params.set(key, String(value));
    }
  });

  return params.toString();
}

/**
 * Builds a full URL with query string
 *
 * @example
 * const url = buildApiUrl('/api/glossary', { language: 'ko', search: 'term' });
 * // Returns: "/api/glossary?language=ko&search=term"
 */
export function buildApiUrl(path: string, filters: Record<string, any>): string {
  const queryString = buildQueryString(filters);
  return queryString ? `${path}?${queryString}` : path;
}
