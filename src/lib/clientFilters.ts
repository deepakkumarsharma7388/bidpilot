export interface ClientFilterSettings {
  excludedRegions: string[]
  minHireRate: number | null
  minTotalSpent: number | null
  requirePaymentVerified: boolean
}

export interface ClientInfo {
  clientCountry: string | null
  clientHireRate: number | null
  clientTotalSpent: number | null
  clientPaymentVerified: boolean | null
}

export interface FilterResult {
  passes: boolean
  reason: string | null
}

// Checks a scraped job's client info against the user's own Settings-defined
// filters. Every threshold is fully dynamic — nothing is hardcoded — so each
// user (or team member) can set their own rules from the Settings page.
export function applyClientFilters(client: ClientInfo, settings: ClientFilterSettings): FilterResult {
  // Region exclusion — case-insensitive match against the client's country
  if (settings.excludedRegions.length > 0 && client.clientCountry) {
    const excluded = settings.excludedRegions.some(
      (region) => region.trim().toLowerCase() === client.clientCountry!.trim().toLowerCase()
    )
    if (excluded) {
      return { passes: false, reason: `Client region "${client.clientCountry}" is on your excluded-regions list` }
    }
  }

  // Minimum hire rate — if we couldn't read a hire rate, we don't block on it
  // (some clients are too new to have one yet), only block when we KNOW it's below threshold.
  if (settings.minHireRate !== null && client.clientHireRate !== null) {
    if (client.clientHireRate < settings.minHireRate) {
      return { passes: false, reason: `Client hire rate (${client.clientHireRate}%) is below your minimum (${settings.minHireRate}%)` }
    }
  }

  // Minimum total spend
  if (settings.minTotalSpent !== null && client.clientTotalSpent !== null) {
    if (client.clientTotalSpent < settings.minTotalSpent) {
      return { passes: false, reason: `Client total spend ($${client.clientTotalSpent}) is below your minimum ($${settings.minTotalSpent})` }
    }
  }

  // Payment verified requirement
  if (settings.requirePaymentVerified && client.clientPaymentVerified === false) {
    return { passes: false, reason: 'Client payment method is not verified' }
  }

  return { passes: true, reason: null }
}