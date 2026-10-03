// Стеклянный стол (?glass=d4,d6): пара грузится, кнопка готова, бросок пишет историю.
import { expect, test, type Page } from '@playwright/test'

const collectErrors = (page: Page): string[] => {
  const errors: string[] = []
  page.on('pageerror', (err) => errors.push(String(err).slice(0, 200)))
  return errors
}

test('пара d4+d6: загрузка, бросок, поп с суммой', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto('/?glass=d4,d6')
  await expect(page.locator('.gtableCanvas')).toBeVisible()
  const throwBtn = page.locator('.gtableThrow')
  await expect(throwBtn).toBeEnabled({ timeout: 90 * 1000 })
  await expect(throwBtn).toContainText('Кинуть • 2')
  await throwBtn.click()
  await expect(page.locator('.historyRow')).toHaveCount(1)
  await expect(page.locator('.result').first()).toBeVisible()
  expect(errors).toEqual([])
})
