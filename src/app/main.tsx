import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import { App } from './App'
import { store } from './store'
import './styles.css'

// Режим стола — синхронно до первого рендера: CSS body[data-mode='mtable']
// должен включиться в тот же тик, что и раньше (до появления React-разметки).
document.body.dataset.mode = 'mtable'

const boot = async (): Promise<void> => {
  // Моки — только по явному флагу (VITE_MOCKS=1): дефолтный dev и все
  // чекеры/e2e ходят в реальные сети, поведение не меняется. Сбой моков
  // не должен кирдить приложение — рендерим в любом случае.
  if (import.meta.env.VITE_MOCKS === '1') {
    try {
      const { enableMsw } = await import('@/shared/api/mocks/browser')
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
