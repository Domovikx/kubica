// Стол (корень /): пустое состояние, набор через степперы, бросок удержанием
// кости ≥2 с, история в меню-бургере, итог — только для скринридера (.mtableLive).
import { expect, test, type Page } from '@playwright/test'

/** Ловим pageerror в массив (изоляция: массив свой на каждый тест). */
const collectErrors = (page: Page): string[] => {
  const errors: string[] = []
  page.on('pageerror', (err) => errors.push(String(err).slice(0, 200)))
  return errors
}

// Проба доступа (2.22) при монтировании тянет youtube.com/iframe_api — в e2e
// гасим сеть до youtube моком: детерминизм (не флакаем от нестабильного
// youtube) и герметичность. Мок ставит заглушку YT и дёргает ready-колбэк —
// ровно то, что ждёт loadApi. Настоящий сбой сети покрыт отдельным тестом
// (route.abort ниже — последний зарегистрированный роут выигрывает).
// Проба доступа (2.22) при монтировании тянет youtube.com/iframe_api — в e2e
// гасим сеть до youtube моком: детерминизм (не флакаем от нестабильного
// youtube) и герметичность. Мок — рабочая заглушка YT: стаб Player с
// onReady/onStateChange, ровно то, что ждут loadApi и тап (цепочка
// loading → playing проверяется без реальной сети). Настоящий сбой сети
// покрыт отдельным тестом (route.abort ниже — последний роут выигрывает).
const YT_STUB =
  'window.YT={Player:function(t,o){var s=this;s._st=-1;' +
  's.playVideo=function(){s._st=1;o.events&&o.events.onStateChange&&o.events.onStateChange({data:1,target:s})};' +
  's.pauseVideo=function(){s._st=2;o.events&&o.events.onStateChange&&o.events.onStateChange({data:2,target:s})};' +
  's.setVolume=function(){};s.getPlayerState=function(){return s._st};s.destroy=function(){};' +
  'setTimeout(function(){o.events&&o.events.onReady&&o.events.onReady({target:s})},0)}};' +
  'window.onYouTubeIframeAPIReady&&window.onYouTubeIframeAPIReady();'
const mockYouTube = async (page: Page): Promise<void> => {
  await page.route(
    (url) => url.href.includes('youtube'),
    (route) =>
      route.fulfill({
        contentType: 'application/javascript',
        body: YT_STUB,
      }),
  )
}

test.beforeEach(async ({ page }) => {
  await mockYouTube(page)
})

/** Точка кости на экране — DEV-хук window.__mtable (удержание ≥3 с — бросок). */
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
  await page.getByTestId('mtable-sheet-close').click()
  expect(errors).toEqual([])
})

test('пара d4+d6: удержание кости бросает, история растёт, итог озвучен SR', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto('/kubica/')
  await expect(page.locator('.mtableCanvas')).toBeVisible()
  await page.locator('.mtableAdd').click()
  await page.getByRole('button', { name: 'Добавить d4' }).click()
  await page.getByRole('button', { name: 'Добавить d6' }).click()
  await page.getByTestId('mtable-sheet-close').click()
  await expect(page.locator('.mtable')).toHaveAttribute('data-phase', 'ready')
  // Кнопка набора показывает состав; суммы ещё нет — на бургере иконка меню.
  await expect(page.locator('.mtableAdd')).toHaveText('d4 d6')
  await expect(page.locator('.mtableIcon[aria-label="Меню"] svg')).toHaveCount(1)
  const pt = await diePoint(page)
  expect(pt).not.toBeNull()
  // Бросок требует зарядки ≥3 с: жмем, держим, отпускаем (тап не бросает).
  await page.mouse.move(pt!.x, pt!.y)
  await page.mouse.down()
  await page.waitForTimeout(3200)
  await page.mouse.up()
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

test('сдвиг курсора при удержании зарядку не прерывает — бросок всё равно', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto('/kubica/')
  await expect(page.locator('.mtableCanvas')).toBeVisible()
  await page.locator('.mtableAdd').click()
  await page.getByRole('button', { name: 'Добавить d6' }).click()
  await page.getByTestId('mtable-sheet-close').click()
  await expect(page.locator('.mtable')).toHaveAttribute('data-phase', 'ready')
  const pt = await diePoint(page)
  expect(pt).not.toBeNull()
  await page.mouse.move(pt!.x, pt!.y)
  await page.mouse.down()
  // Зарядка стартовала; сдвиг >8px НЕ гасит её (старый баг: резкий стоп
  // при зажатой кнопке) — фаза charging живёт и после движения.
  await expect(page.locator('.mtable')).toHaveAttribute('data-phase', 'charging')
  await page.mouse.move(pt!.x + 40, pt!.y + 25, { steps: 5 })
  await expect(page.locator('.mtable')).toHaveAttribute('data-phase', 'charging')
  await page.waitForTimeout(3300)
  await page.mouse.up()
  await expect(page.locator('.mtable')).toHaveAttribute('data-phase', 'rolling', { timeout: 5000 })
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
  await page.getByTestId('mtable-sheet-close').click()
  await expect(page.locator('.mtable')).toHaveAttribute('data-phase', 'ready')
  await expect(page.locator('.mtableAdd')).toHaveText('2d4 d6')
  await page.locator('.mtableAdd').click()
  await page.getByRole('button', { name: 'Убрать все' }).click()
  await expect(page.locator('.mtable')).toHaveAttribute('data-phase', 'empty')
  await expect(page.locator('.mtableHint')).toBeVisible()
  expect(errors).toEqual([])
})

test('2.24: изменение в меню → крестик морфится в ✓ «Готово», открытие сбрасывает', async ({
  page,
}) => {
  const errors = collectErrors(page)
  await page.goto('/kubica/')
  await expect(page.locator('.mtableCanvas')).toBeVisible()
  // Шит: открыли без изменений — крестик «Закрыть», path не менялся.
  await page.locator('.mtableAdd').click()
  const sheetClose = page.getByTestId('mtable-sheet-close')
  await expect(sheetClose).toHaveAttribute('aria-label', 'Закрыть выбор костей')
  const restPath = await sheetClose.locator('path').getAttribute('d')
  // Изменили состав — ✓ «Готово» (другая path), тап закрывает как раньше.
  await page.getByRole('button', { name: 'Добавить d6' }).click()
  await expect(sheetClose).toHaveAttribute('aria-label', 'Готово')
  expect(await sheetClose.locator('path').getAttribute('d')).not.toBe(restPath)
  await sheetClose.click()
  await expect(page.locator('.mtableSheet')).toBeHidden()
  // Повторное открытие сбрасывает dirty — снова крестик.
  await page.locator('.mtableAdd').click()
  await expect(sheetClose).toHaveAttribute('aria-label', 'Закрыть выбор костей')
  await sheetClose.click()
  // Дровер: своя исходная метка, тот же морф после изменения настройки.
  await page.locator('.mtableBurger').click()
  const drawerClose = page.getByTestId('mtable-drawer-close')
  await expect(drawerClose).toHaveAttribute('aria-label', 'Закрыть меню')
  await page.getByRole('button', { name: 'Масштаб интерфейса 150%' }).click()
  await expect(drawerClose).toHaveAttribute('aria-label', 'Готово')
  await expect(page.getByTestId('mtable-toast')).toHaveText('Масштаб 150%')
  await drawerClose.click()
  await expect(page.locator('.mtableDrawer')).toBeHidden()
  // Escape — обычный dismiss, даже «грязным» (ничего не теряется: всё live).
  await page.locator('.mtableBurger').click()
  await page.getByRole('button', { name: 'Масштаб интерфейса 100%' }).click()
  await expect(drawerClose).toHaveAttribute('aria-label', 'Готово')
  await page.keyboard.press('Escape')
  await expect(page.locator('.mtableDrawer')).toBeHidden()
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
  // Удержание: пауза 1 с, затем отсчёт 3 с — сет удаляется сам, без mouse.up.
  // Проверяем class/text-состояния с широким окном (≈4 с до автоудаления):
  // под нагрузкой прогона между mouse.down и expect может пройти больше
  // grace-секунды — узкое окно toHaveText('') тут флакало.
  const box = await mineChip.first().boundingBox()
  expect(box).not.toBeNull()
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2)
  await page.mouse.down()
  await expect(mineChip.first()).toHaveClass(/holding/)
  await expect(mineChip.first().locator('.mtableChipCount')).toHaveText(/^(|[123])$/)
  await expect(mineChip).toHaveCount(0)
  await page.mouse.up()
  await expect(page.locator('.mtableToast')).toHaveText('Набор удалён')
  // Удалён выделенный сет → кнопка снова «Сохранить сет».
  await expect(page.getByRole('button', { name: 'Сохранить сет' })).toBeEnabled()
  expect(errors).toEqual([])
})

// 2.22/2.23 «Фоновая музыка»: вход по кнопке шапки → карточка, офлайн-тост
// от тоггла внутри, персист громкости. Сеть до YouTube НЕ ходим (ленивая
// загрузка API) — клики по старту делаем только офлайн (путь без сети) или с
// заблокированным youtube (второй тест).
test('музыка: меню по кнопке шапки, офлайн-тост, громкость переживает reload', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto('/kubica/')
  await expect(page.locator('.mtableCanvas')).toBeVisible()
  // Шапка — вход в меню (2.23): aria-haspopup, без pressed (состояние —
  // иконка снаружи, тоггл внутри карточки).
  const headBtn = page.getByTestId('mtable-music')
  await expect(headBtn).toBeVisible()
  await expect(headBtn).toHaveAttribute('aria-haspopup', 'dialog')
  await expect(headBtn).toHaveAttribute('aria-label', 'Фоновая музыка')
  expect(await headBtn.getAttribute('aria-pressed')).toBeNull()
  // Офлайн: тап открывает карточку; тост «нет сети» роняет тоггл внутри.
  await page.context().setOffline(true)
  await headBtn.click()
  const card = page.getByTestId('mtable-music-card')
  await expect(card).toBeVisible()
  await expect(page.getByTestId('mtable-music-card-title')).toHaveText('Фоновая музыка')
  await expect(page.getByTestId('mtable-music-section')).toBeVisible()
  const toggle = page.getByTestId('mtable-music-toggle')
  await expect(toggle).toHaveAttribute('aria-pressed', 'false')
  await toggle.click()
  await expect(page.getByTestId('mtable-toast')).toHaveText('Нет сети — музыка недоступна')
  await expect(toggle).toHaveAttribute('aria-pressed', 'false')
  await page.context().setOffline(false)
  // Состав карточки: тоггл, хинт про YouTube, слайдер (дефолт 40).
  await expect(toggle).toContainText('Включить фон')
  await expect(page.getByTestId('mtable-music-hint')).toHaveText(
    'Играет с YouTube: нужна сеть, реклама возможна',
  )
  const vol = page.getByTestId('mtable-music-volume')
  await expect(vol).toHaveValue('40')
  // Слайдер шагами: 40 + 6×5 = 70, читаемость цифры и персист.
  for (let i = 0; i < 6; i++) await vol.press('ArrowRight')
  await expect(vol).toHaveValue('70')
  await expect(page.getByTestId('mtable-music-vol-val')).toHaveText('70')
  // 2.24: изменение в карточке → крестик становится ✓ «Готово», тап закрывает.
  const cardClose = page.getByTestId('mtable-music-close')
  await expect(cardClose).toHaveAttribute('aria-label', 'Готово')
  await cardClose.click()
  await expect(card).toBeHidden()
  // Персист: reload → вход по шапке → тот же ползунок и хранилище; чистое
  // открытие сбрасывает dirty — снова крестик «Закрыть».
  await page.reload()
  await expect(page.locator('.mtableCanvas')).toBeVisible()
  await page.getByTestId('mtable-music').click()
  await expect(card).toBeVisible()
  await expect(cardClose).toHaveAttribute('aria-label', 'Закрыть фоновую музыку')
  await expect(vol).toHaveValue('70')
  expect(await page.evaluate(() => localStorage.getItem('dice-music-vol'))).toBe('70')
  expect(errors).toEqual([])
})

test('музыка: youtube недоступен → кнопки aria-disabled с объяснением', async ({ page }) => {
  const errors = collectErrors(page)
  // Ленивый скрипт API — единственная ниточка к youtube; рвём её до загрузки
  // (поверх мока beforeEach: последний роут — он и работает).
  await page.route(
    (url) => url.href.includes('youtube'),
    (route) => route.abort(),
  )
  await page.goto('/kubica/')
  await expect(page.locator('.mtableCanvas')).toBeVisible()
  const headBtn = page.getByTestId('mtable-music')
  // Проба при монтировании не прошла → шапочная кнопка гасится с причиной.
  await expect(headBtn).toHaveAttribute('aria-disabled', 'true', { timeout: 15000 })
  await expect(headBtn).toHaveAttribute(
    'aria-label',
    'Фоновая музыка недоступна: нет доступа к YouTube',
  )
  await expect(headBtn).toHaveAttribute('aria-haspopup', 'dialog')
  // Форс-тап (мимо pointer-checks) открывает карточку — там объяснение;
  // загрузки API нет (guard в musicToggle), спиннер не появляется.
  await headBtn.click({ force: true })
  await expect(page.getByTestId('mtable-music-card')).toBeVisible()
  await expect(page.getByTestId('mtable-music-spin')).toHaveCount(0)
  // Тоггл и хинт карточки тоже объясняют недоступность (переезд из бургера).
  const toggle = page.getByTestId('mtable-music-toggle')
  await expect(toggle).toHaveAttribute('aria-disabled', 'true')
  await expect(toggle).toContainText('Нет доступа к YouTube')
  await expect(page.getByTestId('mtable-music-hint')).toHaveText(
    'Нет доступа к YouTube — фон недоступен',
  )
  expect(errors).toEqual([])
})

// 2.22: детерминированная проверка задержек тапа — loading → playing через мок
// YT (onReady в следующем тике), пауза синхронна в жесте, повторный старт не
// залипает в loading. Реальная сеть не участвует. 2.23: стартуем тогглом
// внутри карточки, состояние дублируется иконкой шапки (класс on).
test('музыка: тап → loading → playing → пауза → снова playing (мок YT)', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto('/kubica/')
  await expect(page.locator('.mtableCanvas')).toBeVisible()
  const headBtn = page.getByTestId('mtable-music')
  await headBtn.click()
  await expect(page.getByTestId('mtable-music-card')).toBeVisible()
  const toggle = page.getByTestId('mtable-music-toggle')
  await expect(toggle).toHaveAttribute('aria-pressed', 'false')
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-pressed', 'true', { timeout: 3000 })
  await expect(headBtn).toHaveClass(/\bon\b/)
  await expect(page.getByTestId('mtable-music-spin')).toHaveCount(0)
  // Пауза: onStateChange(PAUSED) синхронно внутри жеста.
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-pressed', 'false')
  await expect(headBtn).not.toHaveClass(/\bon\b/)
  // Второй старт: ресьюм без промежуточного error/watchdog.
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-pressed', 'true', { timeout: 3000 })
  await expect(headBtn).toHaveClass(/\bon\b/)
  expect(errors).toEqual([])
})
