import { Provider } from 'react-redux'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { store } from './store'
import { musicUiActions, onMusicChange, applyUiScale } from '@/features'

// Распил styles.css (2026-10-12): единственный css — app/styles/global.css
// (документ/токены/.on-контракт + хост инъекции stylex: unplugin дописывает
// собранный stylex в первый css-ассет и vite линкует его в index.html);
// UI-стили — stylex.
import './styles/global.css'

// Масштаб интерфейса: персист из localStorage уже в сторе (preloadedState) —
// применяем CSS-переменную --ui-scale до первого рендера (как раньше делал
// mountMobileTable перед сборкой DOM).
applyUiScale(store.getState().uiScale.scale)

// Зеркало музыки: движок (music.ts) шлёт onMusicChange → диспатчим в слайс.
// Одна подписка на жизнь страницы; отписка не нужна (синглтон стора).
onMusicChange(() => store.dispatch(musicUiActions.syncFromEngine()))

const boot = async (): Promise<void> => {
  // Моки — только по явному флагу (VITE_MOCKS=1): дефолтный dev и все
  // чекеры/e2e ходят в реальные сети, поведение не меняется. Сбой моков
  // не должен кирдить приложение — рендерим в любом случае.
  if (import.meta.env.VITE_MOCKS === '1') {
    try {
      const { enableMsw } = await import('@/shared/api')
      await enableMsw()
    } catch (error) {
      console.error('[msw] не запустился, работаем без моков:', error)
    }
  }
  createRoot(document.getElementById('root')!).render(
    <Provider store={store}>
      <App />
    </Provider>,
  )
}

void boot()
