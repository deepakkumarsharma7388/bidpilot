import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' })

export interface FakeJobResult {
  isSuspicious: boolean
  reasons: string[]
}

// --- Layer 1: Rule-based checks (fast, free, catches the most common scam patterns) ---

const OFF_PLATFORM_PATTERNS = [
  /whatsapp/i,
  /telegram/i,
  /\bwechat\b/i,
  /\bsignal\b/i,
  /text me at/i,
  /call me at/i,
  /\bgmail\.com\b/i,
  /\byahoo\.com\b/i,
  /\boutlook\.com\b/i,
  /contact me (directly|outside|off)/i,
]

const UPFRONT_FEE_PATTERNS = [
  /processing fee/i,
  /registration fee/i,
  /training fee/i,
  /purchase (the )?software/i,
  /buy (a )?starter kit/i,
  /small (deposit|payment) (is )?required/i,
  /send (money|payment) (to|via) (western union|moneygram|gift card)/i,
  /gift card/i,
]

const UNREALISTIC_PAY_PATTERNS = [
  /\$\d{3,}\s*(per|\/)\s*(hour|hr)\b.{0,40}(no experience|entry level|beginner)/i,
  /easy money/i,
  /guaranteed (income|earnings|pay)/i,
  /work \d+ ?(min|hour)s? .{0,30}earn \$\d+/i,
]

function ruleBasedCheck(title: string, description: string, budget: number | null): string[] {
  const text = `${title} ${description}`
  const reasons: string[] = []

  if (OFF_PLATFORM_PATTERNS.some((p) => p.test(text))) {
    reasons.push('Asks to communicate off-platform (WhatsApp/Telegram/personal email) — common scam tactic to bypass Upwork protections')
  }
  if (UPFRONT_FEE_PATTERNS.some((p) => p.test(text))) {
    reasons.push('Mentions an upfront fee, deposit, or purchase — legitimate Upwork jobs never require you to pay to get hired')
  }
  if (UNREALISTIC_PAY_PATTERNS.some((p) => p.test(text))) {
    reasons.push('Pay-for-effort ratio looks unrealistic for the described work')
  }
  if (description.trim().length < 40) {
    reasons.push('Description is extremely short/vague for the type of work described')
  }

  return reasons
}

// --- Layer 2: AI-based check for subtler scam patterns rules can't catch ---

async function aiCheck(title: string, description: string, budget: number | null, currency: string | null): Promise<string[]> {
  try {
    const prompt = `You are a fraud-detection assistant for a freelance job board. Review this job posting and decide if it shows signs of being a FAKE or SCAM listing (not a real, legitimate job).

Title: ${title}
Budget: ${budget ?? 'not specified'} ${currency ?? ''}
Description: ${description}

Common scam signs: requests to move communication off-platform, upfront payments/fees, unrealistic pay for trivial work, vague/generic copy-paste text, pressure/urgency language, requests for personal/financial info early, "no experience needed, high pay" job-farm style postings.

Reply with ONLY a JSON object, nothing else, in this exact shape:
{"suspicious": true or false, "reasons": ["short reason 1", "short reason 2"]}

If the job looks legitimate, reply {"suspicious": false, "reasons": []}. Keep each reason under 15 words.`

    const result = await model.generateContent(prompt)
    const text = result.response.text().trim()
    const cleaned = text.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(cleaned)

    if (parsed?.suspicious && Array.isArray(parsed.reasons)) {
      return parsed.reasons.filter((r: unknown) => typeof r === 'string')
    }
    return []
  } catch (err) {
    console.error('AI fake-job check error:', err)
    return [] // fail open — don't block a job just because the AI call failed
  }
}

// --- Combined entry point used by the scraping worker ---

export async function detectFakeJob(
  title: string,
  description: string,
  budget: number | null,
  currency: string | null
): Promise<FakeJobResult> {
  const ruleReasons = ruleBasedCheck(title, description, budget)

  // Only bother calling the AI if the rules didn't already find something obvious —
  // saves an API call for the clearest scam cases, and always runs for the rest
  // so subtler scams still get caught.
  const aiReasons = await aiCheck(title, description, budget, currency)

  const reasons = [...new Set([...ruleReasons, ...aiReasons])]

  return {
    isSuspicious: reasons.length > 0,
    reasons,
  }
}