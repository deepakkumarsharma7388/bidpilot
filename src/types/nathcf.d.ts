declare module 'nathcf' {
  export interface NathcfResult {
    token: string | null
    [key: string]: any
  }

  export const nathcf: {
    turnstileMax: (url: string) => Promise<NathcfResult>
    turnstileMin: (url: string, sitekey: string) => Promise<NathcfResult>
  }
}