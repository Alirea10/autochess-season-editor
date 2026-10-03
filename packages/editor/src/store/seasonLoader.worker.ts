import { readSeason, type SeasonLoadInput, type SeasonLoadMessage } from './seasonLoadCore'
import { SeasonLoadError } from './fsStore'

// Avoid mixing the Worker lib with the application's DOM lib.
const workerScope = self as unknown as {
  onmessage: ((event: MessageEvent<SeasonLoadInput>) => void) | null
  postMessage(message: SeasonLoadMessage): void
}

workerScope.onmessage = async ({ data: input }) => {
  try {
    const result = await readSeason(input, progress => workerScope.postMessage({ type: 'progress', progress }))
    workerScope.postMessage({ type: 'result', result })
  } catch (error) {
    workerScope.postMessage({
      type: 'error',
      message: error instanceof Error ? error.message : String(error),
      code: error instanceof SeasonLoadError ? error.code : 'READ_FAILED',
    })
  }
}

workerScope.postMessage({ type: 'ready' })
