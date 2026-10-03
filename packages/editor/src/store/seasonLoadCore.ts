import type { AutoChessSeasonData } from '@autochess-editor/shared'
import { normalizeSeasonDataForRuntime } from '@autochess-editor/shared'
import {
  createLoadProgressReporter, loadFromDirectory, parseSeasonJson, SeasonLoadError,
  type LoadProgress, type ProjectMeta, type SeasonLoadOptions,
} from './fsStore'

export type SeasonLoadInput =
  | { kind: 'directory'; directory: FileSystemDirectoryHandle }
  | { kind: 'json'; source: File | string; filename?: string }

export interface SeasonLoadResult {
  data: AutoChessSeasonData
  meta?: ProjectMeta
}

export type SeasonLoadMessage =
  | { type: 'ready' }
  | { type: 'progress'; progress: LoadProgress }
  | { type: 'result'; result: SeasonLoadResult }
  | { type: 'error'; message: string; code: string }

export async function readSeason(
  input: SeasonLoadInput,
  onProgress?: (progress: LoadProgress) => void,
  options: SeasonLoadOptions = {},
): Promise<SeasonLoadResult> {
  if (input.kind === 'directory') return loadFromDirectory(input.directory, onProgress, options)
  const report = createLoadProgressReporter(progress => {
    if (!options.signal?.aborted) onProgress?.(progress)
  })
  const filename = input.filename || (typeof input.source === 'string' ? '粘贴数据' : input.source.name)
  options.signal?.throwIfAborted()
  report({ current: 0, total: 1, field: filename, phase: 'reading' })
  if (options.yieldToMainThread) await new Promise<void>(resolve => setTimeout(resolve, 0))
  let text: string
  try {
    text = typeof input.source === 'string' ? input.source : await input.source.text()
  } catch (error) {
    throw new SeasonLoadError(`读取 ${filename} 失败：${String(error)}`)
  }
  options.signal?.throwIfAborted()
  const parsed = parseSeasonJson(text, filename)
  if (typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new SeasonLoadError('数据结构不完整，请确认是 AutoChessSeasonData 格式', 'INVALID_DATA')
  }
  const data = parsed as AutoChessSeasonData
  for (const field of ['modeDataDict', 'bondInfoDict', 'charShopChessDatas'] as const) {
    if (!data[field] || typeof data[field] !== 'object' || Array.isArray(data[field])) {
      throw new SeasonLoadError(`数据结构不完整：${field} 应为对象，请确认是 AutoChessSeasonData 格式`, 'INVALID_DATA')
    }
  }
  report({ current: 1, total: 1, field: filename, phase: 'normalizing' })
  if (options.yieldToMainThread) await new Promise<void>(resolve => setTimeout(resolve, 0))
  options.signal?.throwIfAborted()
  const normalized = normalizeSeasonDataForRuntime(data)
  report({ current: 1, total: 1, field: filename, phase: 'done' })
  return { data: normalized }
}
