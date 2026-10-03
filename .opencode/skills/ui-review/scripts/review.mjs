// UI-review matrix: routes x viewports + throw marathon with overlap audit.
// Usage: node review.mjs [--throws N] [--out ./tmp/shots/ui-review]
// Prints a JSON summary; screenshots land in --out. Read-only for the repo.
/* global console, document, process, window */
import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright'

const args = process.argv.slice(2)
const opt = (name, fallback) => {
  const i = args.indexOf(name)
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback
}
const THROWS = Number.parseInt(opt('--throws', '2'), 10) || 0
const OUT = opt('--out', './tmp/shots/ui-review')
const BASE = opt('--base', 'http://127.0.0.1:5173/kubica')
mkdirSync(OUT, { recursive: true })

const VIEWPORTS = [
  { tag: 'mob', width: 390, height: 844, mobile: true },
  { tag: 'tab', width: 768, height: 900, mobile: false },
  { tag: 'desk', width: 1280, height: 800, mobile: false },
]

const launchOpts = { args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] }

const geometry = () =>
  page.evaluate(() => {
    const r = (s) => {
      const el = document.querySelector(s)
      if (!el) return null
      const b = el.getBoundingClientRect()
      return {
        x: Math.round(b.x),
        y: Math.round(b.y),
        w: Math.round(b.width),
        h: Math.round(b.height),
      }
    }
    const btns = {}
    for (const s of ['.mtableAdd', '.mtableIcon', '.gtableThrow']) {
      const b = r(s)
      if (b && b.w > 0) btns[s] = { ...b, min: Math.min(b.w, b.h) }
    }
    const cv = document.querySelector('.mtableCanvas') || document.querySelector('.gtableCanvas')
    const cbox = cv ? cv.getBoundingClientRect() : null
    return {
      hScroll: document.scrollingElement.scrollWidth > window.innerWidth + 1,
      mtableX: r('.mtable')?.x ?? null,
      canvas: cbox ? { w: Math.round(cbox.width), h: Math.round(cbox.height) } : null,
      buttons: btns,
      // ?m=1: кнопки броска нет — фаза стола; legacy glass — текст кнопки.
      phase: document.querySelector('.mtable')?.getAttribute('data-phase') ?? null,
      throwText:
        document
          .querySelector('.gtableThrow')
          ?.textContent?.replace(/\s+/g, ' ')
          .trim()
          .slice(0, 60) ?? null,
    }
  })

let page
const summary = { shots: [], errors: [], geometry: {}, throws: [], overlaps: [] }

const browser = await chromium.launch(launchOpts)
try {
  for (const vp of VIEWPORTS) {
    page = await browser.newPage({
      viewport: { width: vp.width, height: vp.height },
      isMobile: vp.mobile,
      hasTouch: true,
    })
    page.on('pageerror', (e) =>
      summary.errors.push(`[${vp.tag}] pageerror: ${String(e).slice(0, 150)}`),
    )
    page.on('console', (m) => {
      const t = m.text()
      if (m.type() === 'error') summary.errors.push(`[${vp.tag}] console: ${t.slice(0, 150)}`)
      if (t.includes('overlap after settle'))
        summary.overlaps.push(`[${vp.tag}] ${t.slice(0, 120)}`)
    })
    await page.goto(`${BASE}/?m=1`, { waitUntil: 'load' })
    await page.waitForSelector('.mtableCanvas', { timeout: 20000 })
    await page.waitForTimeout(2500)
    await page.screenshot({ path: `${OUT}/${vp.tag}-m-empty.png` })
    summary.geometry[`${vp.tag}-m-empty`] = await geometry()
    await page.close()
  }

  // Pair on ?m=1 via steppers + marathon (mobile viewport).
  page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  })
  page.on('pageerror', (e) =>
    summary.errors.push(`[marathon] pageerror: ${String(e).slice(0, 150)}`),
  )
  page.on('console', (m) => {
    const t = m.text()
    if (m.type() === 'error') summary.errors.push(`[marathon] console: ${t.slice(0, 150)}`)
    if (t.includes('overlap after settle')) summary.overlaps.push(`[marathon] ${t.slice(0, 120)}`)
  })
  await page.goto(`${BASE}/?m=1`, { waitUntil: 'load' })
  await page.waitForSelector('.mtableCanvas', { timeout: 20000 })
  await page.waitForTimeout(1500)
  await page.locator('.mtableAdd').click()
  await page.waitForTimeout(400)
  // Формулы больше нет — набор степперами в шторке.
  await page.getByRole('button', { name: 'Добавить d4' }).click()
  await page.getByRole('button', { name: 'Добавить d6' }).click()
  await page.waitForTimeout(200)
  await page.getByLabel('Закрыть выбор костей').click()
  const waitReady = (tag) =>
    page
      .waitForFunction(
        () => document.querySelector('.mtable')?.getAttribute('data-phase') === 'ready',
        null,
        { timeout: 90000 },
      )
      .catch(() => summary.errors.push(`[marathon] ${tag}: table never ready`))
  await waitReady('setup')
  await page.waitForTimeout(2000)
  await page.screenshot({ path: `${OUT}/mob-m-pair.png` })
  summary.geometry['mob-m-pair'] = await geometry()
  for (let i = 1; i <= THROWS; i++) {
    await waitReady(`throw${i}-pre`)
    const t0 = Date.now()
    const before = await page
      .locator('.mtableHrow')
      .count()
      .catch(() => 0)
    // Бросок = тап по кости (DEV-хук отдаёт точку raycast'а).
    const dp = await page.evaluate(() => window.__mtable?.diePoint() ?? null)
    if (!dp) {
      summary.errors.push(`[marathon] throw${i}: diePoint null`)
      break
    }
    await page.mouse.click(dp.x, dp.y)
    const grew = await page
      .waitForFunction((n) => document.querySelectorAll('.mtableHrow').length > n, before, {
        timeout: 150000,
      })
      .then(() => true)
      .catch(() => false)
    await waitReady(`throw${i}-post`)
    summary.throws.push({ i, wallSec: +((Date.now() - t0) / 1000).toFixed(1), historyGrew: grew })
  }
  await page.waitForTimeout(1500)
  await page.screenshot({ path: `${OUT}/mob-m-landed.png` })
  summary.geometry['mob-m-landed'] = await geometry()
  await page.close()

  // Glass pair (legacy table) on desktop.
  page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
  page.on('pageerror', (e) => summary.errors.push(`[glass] pageerror: ${String(e).slice(0, 150)}`))
  page.on('console', (m) => {
    if (m.type() === 'error') summary.errors.push(`[glass] console: ${m.text().slice(0, 150)}`)
  })
  await page.goto(`${BASE}/?glass=d4,d6`, { waitUntil: 'load' })
  await page.waitForSelector('.gtableCanvas', { timeout: 20000 })
  await page.waitForTimeout(6000)
  await page.screenshot({ path: `${OUT}/desk-glass-pair.png` })
  summary.geometry['desk-glass-pair'] = await geometry()
  await page.close()
} finally {
  await browser.close()
}

summary.shots = [
  'mob-m-empty',
  'tab-m-empty',
  'desk-m-empty',
  'mob-m-pair',
  'mob-m-landed',
  'desk-glass-pair',
]
console.log(JSON.stringify(summary, null, 1))
