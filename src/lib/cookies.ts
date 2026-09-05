/**
 * Cleans a raw cookie array (as exported by browser extensions like Cookie-Editor)
 * into the exact shape Playwright's `context.addCookies()` expects.
 *
 * Browser extensions often export `sameSite` as `null`, `"no_restriction"`,
 * `"unspecified"`, or omit it entirely — Playwright only accepts the exact
 * strings "Strict", "Lax", or "None". This maps common export formats to the
 * closest valid Playwright value instead of failing the whole scrape.
 */
export function sanitizeCookiesForPlaywright(rawCookies: any[]): any[] {
  return rawCookies
    .filter((c) => c && typeof c.name === 'string' && typeof c.value === 'string')
    .map((c) => {
      let sameSite: 'Strict' | 'Lax' | 'None' = 'Lax'
      const raw = (c.sameSite ?? '').toString().toLowerCase()

      if (raw === 'strict') sameSite = 'Strict'
      else if (raw === 'no_restriction' || raw === 'none') sameSite = 'None'
      else if (raw === 'lax' || raw === 'unspecified' || raw === '') sameSite = 'Lax'

      // Playwright requires either `url` or both `domain` and `path`.
      const cleaned: any = {
        name: c.name,
        value: c.value,
        domain: c.domain,
        path: c.path || '/',
        sameSite,
      }

      if (typeof c.expirationDate === 'number') {
        cleaned.expires = c.expirationDate
      }
      if (typeof c.httpOnly === 'boolean') cleaned.httpOnly = c.httpOnly
      if (typeof c.secure === 'boolean') cleaned.secure = c.secure

      // "None" cookies must be marked secure, or browsers reject them
      if (sameSite === 'None') cleaned.secure = true

      return cleaned
    })
}