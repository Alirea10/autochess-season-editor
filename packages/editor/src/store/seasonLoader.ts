import {
  readSeason, type SeasonLoadInput, type SeasonLoadMessage, type SeasonLoadResult,
} from './seasonLoadCore'
import {
  createLoadProgressReporter, SeasonLoadError,
  type LoadProgress, type ProjectMeta,
} from './fsStore'

export interface LoadSeasonOptions {
  onProgress?: (progress: LoadProgress) => void
  signal?: AbortSignal
}

/** One disposable Worker per operation; only startup/capability failures fall back. */
function loadSeason(input: SeasonLoadInput, options: LoadSeasonOptions): Promise<SeasonLoadResult> {
  const { signal } = options
  const report = createLoadProgressReporter(progress => {
    if (!signal?.aborted) options.onProgress?.(progress)
  })
  const fallback = () => readSeason(input, report, { signal, yieldToMainThread: true })
  if (signal?.aborted) return Promise.reject(signal.reason)
  if (typeof Worker === 'undefined') return fallback()

  let worker: Worker
  try {
    worker = new Worker(new URL('./seasonLoader.worker.ts', import.meta.url), { type: 'module' })
  } catch {
    return fallback()
  }
  return new Promise((resolve, reject) => {
    let started = false
    let settled = false
    let startupTimer: ReturnType<typeof setTimeout>
    const cleanup = () => {
      clearTimeout(startupTimer)
      signal?.removeEventListener('abort', abort)
      worker.onmessage = null
      worker.onerror = null
      worker.onmessageerror = null
      worker.terminate()
    }
    const fail = (error: unknown) => {
      if (settled) return
      settled = true
      cleanup()
      reject(error)
    }
    const abort = () => fail(signal?.reason ?? new DOMException('加载已取消', 'AbortError'))
    const useFallback = () => {
      if (settled) return
      settled = true
      cleanup()
      fallback().then(resolve, reject)
    }
    startupTimer = setTimeout(useFallback, 5000)
    signal?.addEventListener('abort', abort, { once: true })
    worker.onmessage = ({ data: message }: MessageEvent<SeasonLoadMessage>) => {
      if (settled) return
      if (message.type === 'ready') {
        clearTimeout(startupTimer)
        try {
          worker.postMessage(input)
          started = true
        } catch {
          useFallback()
        }
      } else if (message.type === 'progress') {
        report(message.progress)
      } else if (message.type === 'error') {
        fail(new SeasonLoadError(message.message, message.code))
      } else if (message.type === 'result') {
        settled = true
        cleanup()
        resolve(message.result)
      }
    }
    worker.onerror = event => {
      event.preventDefault()
      if (!started) useFallback()
      else fail(new SeasonLoadError(`加载失败：${event.message}`))
    }
    worker.onmessageerror = () => {
      if (!started) useFallback()
      else fail(new SeasonLoadError('加载结果读取失败，请重新加载'))
    }
    if (signal?.aborted) abort()
  })
}

export function loadSeasonJson(source: File | string, options: LoadSeasonOptions = {}) {
  return loadSeason({ kind: 'json', source }, options)
}

export async function loadSeasonDirectory(directory: FileSystemDirectoryHandle, options: LoadSeasonOptions = {}) {
  const result = await loadSeason({ kind: 'directory', directory }, options)
  return { data: result.data, meta: result.meta as ProjectMeta }
}
