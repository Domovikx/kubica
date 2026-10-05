// Стол (корень /): пустое состояние, набор через степперы, бросок тапом по кости,
// история в меню-бургере, итог — только для скринридера (.mtableLive).
import { expect, test, type Page } from '@playwright/test'

/** Ловим pageerror в массив (изоляция: массив свой на каждый тест). */
const collectErrors = (page: Page): string[] => {
  const errors: string[] = []
  page.on('pageerror', (err) => errors.push(String(err).slice(0, 200)))
  return errors
}

/** Точка кости на экране — DEV-хук window.__mtable (тап = единственный бросок). */
const diePoint = (page: Page) =>
  page.evaluate(
    () =>
      (
        window as unknown as { __mtable?: { diePoint: () => { x: number; y: number } | null } }
      ).__mtable?.diePoint() ?? null,
  )

test('пустой стол: хинт, две менюшки шапки, кнопки броска нет', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto('/kubica/')
  await expect(page.locator('.mtableCanvas')).toBeVisible()
  await expect(page.locator('.mtableHint')).toBeVisible()
  await expect(page.locator('.mtable')).toHaveAttribute('data-phase', 'empty')
  // Нижней кнопки броска больше нет — бросает сама кость.
  await expect(page.locator('.mtableThrow')).toHaveCount(0)
  await page.locator('.mtableAdd').click()
  await expect(page.locator('.mtableSheet')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Убрать все' })).toBeVisible()
  // Пресеты живут в шторке: чипы-глифы без подписей, тап применяет и НЕ закрывает.
  const firstChip = page.locator('.mtableFast .mtableChip').first()
  await expect(firstChip).toBeVisible()
  await firstChip.click()
  await expect(page.locator('.mtableSheet')).toBeVisible()
  await expect(page.locator('.mtableAdd')).toHaveText('2d20')
  await expect(firstChip).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: 'Обновить набор' })).toBeVisible()
  await page.getByLabel('Закрыть выбор костей').click()
  expect(errors).toEqual([])
})

test('пара d4+d6: тап по кости бросает, история растёт, итог озвучен SR', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto('/kubica/')
  await expect(page.locator('.mtableCanvas')).toBeVisible()
  await page.locator('.mtableAdd').click()
  await page.getByRole('button', { name: 'Добавить d4' }).click()
  await page.getByRole('button', { name: 'Добавить d6' }).click()
  await page.getByLabel('Закрыть выбор костей').click()
  await expect(page.locator('.mtable')).toHaveAttribute('data-phase', 'ready')
  // Кнопка набора показывает состав; суммы ещё нет — на бургере иконка меню.
  await expect(page.locator('.mtableAdd')).toHaveText('d4 d6')
  await expect(page.locator('.mtableIcon[aria-label="Меню"] svg')).toHaveCount(1)
  const pt = await diePoint(page)
  expect(pt).not.toBeNull()
  await page.mouse.click(pt!.x, pt!.y)
  await page
    .waitForFunction(
      () => document.querySelector('.mtable')?.getAttribute('data-phase') === 'rolling',
      undefined,
      { timeout: 5000 },
    )
    .catch(() => undefined)
  // Пока кости летят — на бургере лоадер (disabled), не кнопка меню/суммы.
  if ((await page.locator('.mtable').getAttribute('data-phase')) === 'rolling') {
    await expect(page.locator('.mtableBurger .mtableSpin')).toHaveCount(1)
    await expect(page.locator('.mtableBurger')).toBeDisabled()
  }
  await expect(page.locator('.mtable')).toHaveAttribute('data-phase', 'ready', { timeout: 90000 })
  // После броска бургер снова кнопка с суммой (лоадер убран).
  await expect(page.locator('.mtableBurger .mtableSpin')).toHaveCount(0)
  await expect(page.locator('.mtableHrow')).toHaveCount(1)
  // Сумма — крупная акцентная на бургере, разбивка пробелами — в футере.
  await expect(page.locator('.mtableBurger')).toHaveText(/^\d+$/)
  await expect(page.locator('.mtableBurger')).toHaveClass(/hasSum/)
  await expect(page.locator('.mtableFootParts')).toHaveText(/\d/)
  // Итог визуально нигде — но скринридер его озвучил («d4 d6: 5 · 3 2»).
  await expect(page.locator('.mtableLive')).toHaveText(/^.+: \d+/)
  expect(errors).toEqual([])
})

test('шит: степперы считают, минус на нуле молчит, «убрать все» чистит', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto('/kubica/')
  await expect(page.locator('.mtableCanvas')).toBeVisible()
  await page.locator('.mtableAdd').click()
  // Минус на нуле disabled (до набора).
  const minusD4 = page.locator('.mtableRow', { hasText: 'пирамида' }).getByRole('button', {
    name: 'Убрать d4',
  })
  await expect(minusD4).toBeDisabled()
  // Набираем 2d4+d6 степперами → кнопка в шапке показывает состав.
  const plusD4 = page.getByRole('button', { name: 'Добавить d4' })
  await plusD4.click()
  await plusD4.click()
  await page.getByRole('button', { name: 'Добавить d6' }).click()
  // Минус уже активен (на столе 2×d4); проверяем, пока шторка открыта.
  await expect(minusD4).toBeEnabled()
  await page.getByLabel('Закрыть выбор костей').click()
  await expect(page.locator('.mtable')).toHaveAttribute('data-phase', 'ready')
  await expect(page.locator('.mtableAdd')).toHaveText('2d4 d6')
  await page.locator('.mtableAdd').click()
  await page.getByRole('button', { name: 'Убрать все' }).click()
  await expect(page.locator('.mtable')).toHaveAttribute('data-phase', 'empty')
  await expect(page.locator('.mtableHint')).toBeVisible()
  expect(errors).toEqual([])
})

test('сеты: сохранить → изменить → обновить, удержание с паузой удаляет', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto('/kubica/')
  await expect(page.locator('.mtableCanvas')).toBeVisible()
  await page.locator('.mtableAdd').click()
  // Пустой стол — сохранять нечего.
  await expect(page.getByRole('button', { name: 'Сохранить сет' })).toBeDisabled()
  await page.getByRole('button', { name: 'Добавить d8' }).click()
  await page.getByRole('button', { name: 'Сохранить сет' }).click()
  // Новый сет появился в «Мои» и сразу выделен (кнопка → «Обновить набор»).
  const mineChip = page.locator('.mtableMine .mtableChip')
  await expect(mineChip).toHaveCount(1)
  await expect(mineChip.first()).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: 'Обновить набор' })).toBeEnabled()
  // Меняем состав → «Обновить набор» перезаписывает выделенный сет.
  await page.getByRole('button', { name: 'Добавить d6' }).click()
  await page.getByRole('button', { name: 'Обновить набор' }).click()
  await expect(mineChip.first()).toHaveAttribute('aria-label', 'Набор: d6 d8')
  // Нажатие не запускает отсчёт: первая секунда — пауза, затем отсчёт 3 с.
  const box = await mineChip.first().boundingBox()
  expect(box).not.toBeNull()
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2)
  await page.mouse.down()
  await expect(mineChip.first().locator('.mtableChipCount')).toHaveText('')
  await page.waitForTimeout(1100)
  await expect(mineChip.first().locator('.mtableChipCount')).toHaveText(/^[123]$/)
  await page.waitForTimeout(3400)
  await page.mouse.up()
  await expect(mineChip).toHaveCount(0)
  await expect(page.locator('.mtableToast')).toHaveText('Набор удалён')
  // Удалён выделенный сет → кнопка снова «Сохранить сет».
  await expect(page.getByRole('button', { name: 'Сохранить сет' })).toBeEnabled()
  expect(errors).toEqual([])
})
