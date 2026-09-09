import { nathcf } from 'nathcf'

// ⚠️ TESTING ONLY: nathcf proxies requests to an unverified third-party server
// (cf-solver-renofc.my.id). Swap this out for capsolver-npm before relying on
// this in anything beyond local testing.

export interface TurnstileSolveResult {
  token: string | null
}

export async function solveTurnstileWithNathcf(url: string): Promise<string | null> {
  try {
    const result = await nathcf.turnstileMax(url)
    return result?.token ?? null
  } catch (err) {
    console.error('nathcf solve failed:', (err as Error).message)
    return null
  }
}