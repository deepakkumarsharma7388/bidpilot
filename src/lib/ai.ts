import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' })

export async function getMatchScore(description: string, expertise: string): Promise<number> {
  try {
    const result = await model.generateContent(
      `Return only a number between 0 and 1 (no text, no explanation) for how well this job matches the expertise.\nJob: ${description}\nExpertise: ${expertise}\nScore:`
    )
    const text = result.response.text().trim()
    const score = parseFloat(text)
    if (isNaN(score)) return 0
    return Math.min(Math.max(score, 0), 1)
  } catch (err) {
    console.error('Gemini match score error:', err)
    return 0
  }
}

export async function generateProposal(
  jobTitle: string,
  jobDesc: string,
  expertise: string,
  name: string
): Promise<string> {
  try {
    const prompt = `You are ${name}, a real freelancer writing a personal Upwork proposal by hand — not a marketing copywriter, not an AI. Write like you're messaging the client directly, the way an experienced freelancer actually talks: plain, direct, a little informal, no fluff.

Job Title: ${jobTitle}
Job Description: ${jobDesc}
My background/expertise: ${expertise}

Write the proposal following these rules exactly:

1. Open with something specific from THIS job post (not a generic greeting like "Hi there" or "I hope this finds you well"). Reference an actual detail from the description in the first line.
2. Keep it under 150 words total. Short paragraphs, no walls of text.
3. Plain conversational sentences only — NO bullet points, NO bold text, NO markdown formatting, NO emojis, NO headers. Write it exactly as you'd type a real message to someone.
4. Do NOT use generic freelancer buzzwords like "bulletproof", "seamless", "cutting-edge", "passionate", "extensive experience", "state-of-the-art". If you mention experience, be specific and understated instead (e.g. "I built something similar for a client last year" rather than vague claims).
5. Ask exactly 2 short, genuinely useful questions about the project — woven naturally into a sentence or short paragraph, not a numbered list.
6. Mention, in one plain sentence, that you're open to splitting payment into milestones — do not list out milestone names or a breakdown, just mention the idea briefly and naturally.
7. End with a short, low-pressure closing line (not "Best regards" + bold name — just a natural sign-off like a real message would have).
8. Vary your sentence structure and opening style each time — do not follow a rigid template.

Write only the final proposal text, nothing else.`

    const result = await model.generateContent(prompt)
    return result.response.text().trim()
  } catch (err) {
    console.error('Gemini proposal generation error:', err)
    return ''
  }
}

// Classifies a job into exactly one of the user's own lanes (from Settings),
// using AI understanding instead of literal word/phrase matching. This catches
// cases like "edit my YouTube videos" correctly matching a "Video Editing" lane,
// while still being strict — it must pick from the given list only, or 'General'.
export async function detectLaneWithAI(
  jobTitle: string,
  jobDescription: string,
  userLanes: string[]
): Promise<string> {
  if (!userLanes || userLanes.length === 0) return 'General'

  try {
    const lanesList = userLanes.map((l, i) => `${i + 1}. ${l}`).join('\n')

    const prompt = `You are a strict job classifier. Below is a list of allowed categories (lanes) and a job posting.

Allowed lanes:
${lanesList}

Job Title: ${jobTitle}
Job Description: ${jobDescription}

Task: Decide which ONE lane from the allowed list this job clearly and genuinely belongs to, based on its actual meaning (not just keyword overlap).
Rules:
- Reply with the EXACT text of one lane from the allowed list above, copied exactly as written, and nothing else.
- If the job does not clearly and confidently match any lane, reply with exactly: General
- Do not explain. Do not add punctuation. Do not guess if unsure — prefer "General" over a weak/uncertain match.

Answer:`

    const result = await model.generateContent(prompt)
    const answer = result.response.text().trim()

    // Only accept the answer if it exactly matches one of the user's real lanes
    const matchedLane = userLanes.find(
      (lane) => lane.trim().toLowerCase() === answer.toLowerCase()
    )

    return matchedLane || 'General'
  } catch (err) {
    console.error('Gemini lane detection error:', err)
    return 'General'
  }
}