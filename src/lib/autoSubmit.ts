
import { chromium } from 'playwright'
import { prisma } from './prisma'
import { sanitizeCookiesForPlaywright } from './cookies'

export async function autoSubmitProposal(
  userId: string,
  jobUrl: string,
  proposalText: string,
  jobId: string
): Promise<{ success: boolean; error?: string }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { upworkCookies: true, autoSubmit: true }
  })

  if (!user?.upworkCookies) {
    return { success: false, error: 'Cookies missing' }
  }
  if (!user.autoSubmit) {
    return { success: false, error: 'Auto-submit disabled in settings' }
  }

  let browser
  try {
    browser = await chromium.launch({
      headless: false,
      slowMo: 200
    })

    const context = await browser.newContext({
      viewport: { width: 1366, height: 768 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    })

    const cookies = sanitizeCookiesForPlaywright(JSON.parse(user.upworkCookies))
    await context.addCookies(cookies)

    const page = await context.newPage()

    await page.goto(jobUrl, { waitUntil: 'networkidle' })
    await page.waitForTimeout(3000 + Math.random() * 2000)

    // NOTE: These selectors use text-based matching (resilient to Upwork's internal
    // class-name changes) rather than guessed CSS classes. They have NOT been verified
    // against Upwork's real "Submit a Proposal" form yet, because that form only renders
    // once the account has enough Connects — until then Upwork shows a "Buy Connects to
    // apply" prompt instead. Once Connects are available, re-test this flow end-to-end
    // and adjust selectors below if Upwork's actual markup differs.

    // If the account has 0 Connects, Upwork shows "Buy Connects to apply" instead of the
    // real submit button — detect this early and fail with a clear, actionable error
    // rather than timing out on a button that will never appear.
    const buyConnectsButton = page.getByRole('button', { name: /buy connects/i })
    if (await buyConnectsButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await browser.close()
      await prisma.proposal.updateMany({
        where: { jobId, userId },
        data: { status: 'FAILED', submitError: 'Not enough Connects to submit a proposal' }
      })
      return { success: false, error: 'Not enough Connects to submit a proposal on Upwork' }
    }

    // Open the proposal form
    const submitBtn = page.getByRole('button', { name: /submit a proposal/i })
    await submitBtn.waitFor({ timeout: 15000 })
    await submitBtn.click()
    await page.waitForTimeout(2000 + Math.random() * 1000)

    // Cover letter — try the common Upwork field name first, fall back to any
    // large textarea on the page if the exact name attribute differs.
    let textarea = page.locator('textarea[name="coverLetter"]')
    if (!(await textarea.isVisible({ timeout: 5000 }).catch(() => false))) {
      textarea = page.locator('textarea').first()
    }
    await textarea.waitFor({ timeout: 10000 })
    await textarea.click()
    await page.waitForTimeout(500)
    await textarea.fill('') // clear any prefilled content
    await textarea.type(proposalText, { delay: 30 })

    // Final submit button on the proposal form (distinct from the one that opens it)
    const finalSubmit = page.getByRole('button', { name: /^submit proposal$/i })
    await finalSubmit.click()

    // Wait for a success confirmation. Upwork's exact wording may vary, so check
    // a couple of likely phrases.
    await Promise.race([
      page.waitForSelector('text=/proposal submitted/i', { timeout: 15000 }),
      page.waitForSelector('text=/application submitted/i', { timeout: 15000 }),
    ])

    await browser.close()

    await prisma.proposal.updateMany({
      where: { jobId, userId },
      data: { status: 'SENT', sentAt: new Date() }
    })
    await prisma.job.update({
      where: { id: jobId },
      data: { status: 'PROPOSAL_SENT' }
    })

    return { success: true }
  } catch (error: any) {
    if (browser) await browser.close()
    const errorMsg = error.message || 'Unknown error'
    await prisma.proposal.updateMany({
      where: { jobId, userId },
      data: { status: 'FAILED', submitError: errorMsg }
    })
    return { success: false, error: errorMsg }
  }
}