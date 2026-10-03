/**
 * fsStore.ts — Web File System Access API 封装
 *
 * 目录结构：
 *   <dir>/
 *     project.json           ← { label, version, savedAt, constFields: {...} }
 *     modeDataDict/          ← 每条记录一个 .json 文件
 *     bondInfoDict/
 *     charChessDataDict/
 *     charShopChessDatas/
 *     trapChessDataDict/
 *     trapShopChessDatas/
 *     effectInfoDataDict/
 *     effectBuffInfoDataDict/
 *     bossInfoDict/
 *     shopCharChessInfoData/
 *     garrisonDataDict/
 *     bandDataListDict/
 *     stageDatasDict/
 *     shopLevelDisplayDataDict/
 *     specialEnemyInfoDict/
 *     effectChoiceInfoDict/
 *     buffTemplates/
 */

import type { AutoChessSeasonData } from '@autochess-editor/shared'
import {
  normalizeSeasonDataForDirectory,
  normalizeSeasonDataForRuntime,
  deepSortValue,
} from '@autochess-editor/shared'

/** 所有以独立文件存储的 dict 字段名 */
const DICT_FIELDS: (keyof AutoChessSeasonData)[] = [
  'modeDataDict',
  'bondInfoDict',
  'charChessDataDict',
  'charShopChessDatas',
  'trapChessDataDict',
  'trapShopChessDatas',
  'effectInfoDataDict',
  'effectBuffInfoDataDict',
  'bossInfoDict',
  'shopCharChessInfoData',
  'garrisonDataDict',
  'bandDataListDict',
  'stageDatasDict',
  'shopLevelDisplayDataDict',
  'specialEnemyInfoDict',
  'effectChoiceInfoDict',
  'buffTemplates',
]

const DICT_FIELD_NAMES = new Set<string>(DICT_FIELDS)

/** 只对已知字典拆分文件；其他字段（包括未来扩展）原样保存在 project.json。 */
function getProjectConstFields(data: AutoChessSeasonData): ProjectMeta['constFields'] {
  return Object.fromEntries(
    Object.entries(data).filter(([field]) => !DICT_FIELD_NAMES.has(field)),
  )
}

// ── helpers ──────────────────────────────────────────────────────────────────

type JsonLineEnding = '\n' | '\r\n' | '\r'

interface JsonTextFormat {
  lineEnding: JsonLineEnding
  trailingNewlines: string
}

const DEFAULT_JSON_TEXT_FORMAT: JsonTextFormat = {
  lineEnding: '\n',
  trailingNewlines: '\n',
}

async function getOrCreateDir(root: FileSystemDirectoryHandle, name: string) {
  return root.getDirectoryHandle(name, { create: true })
}

function detectLineEnding(content: string): JsonLineEnding {
  const withoutCrLf = content.replace(/\r\n/g, '')
  const crlfCount = content.match(/\r\n/g)?.length ?? 0
  const lfCount = withoutCrLf.match(/\n/g)?.length ?? 0
  const crCount = withoutCrLf.match(/\r/g)?.length ?? 0

  if (crlfCount >= lfCount && crlfCount >= crCount && crlfCount > 0) return '\r\n'
  if (lfCount >= crCount && lfCount > 0) return '\n'
  if (crCount > 0) return '\r'
  return DEFAULT_JSON_TEXT_FORMAT.lineEnding
}

function detectJsonTextFormat(content: string): JsonTextFormat {
  return {
    lineEnding: detectLineEnding(content),
    trailingNewlines: content.match(/(?:\r\n|\n|\r)+$/)?.[0] ?? '',
  }
}

function formatJsonText(data: unknown, format: JsonTextFormat): string {
  const body = JSON.stringify(data, null, 2)
  return (format.lineEnding === '\n' ? body : body.replace(/\n/g, format.lineEnding)) + format.trailingNewlines
}

async function readJsonFileText(dir: FileSystemDirectoryHandle, filename: string): Promise<string | null> {
  try {
    const fh = await dir.getFileHandle(filename)
    const file = await fh.getFile()
    return await file.text()
  } catch (error) {
    if ((error as DOMException)?.name === 'NotFoundError') return null
    throw new Error(`读取 ${dir.name}/${filename} 失败：${String(error)}`)
  }
}

async function detectDirectoryJsonTextFormat(dir: FileSystemDirectoryHandle): Promise<JsonTextFormat | null> {
  const filenames: string[] = []
  // @ts-ignore
  for await (const [name] of dir.entries()) {
    if (typeof name === 'string' && name.endsWith('.json')) filenames.push(name)
  }

  filenames.sort()
  for (const filename of filenames) {
    const content = await readJsonFileText(dir, filename)
    if (content !== null) return detectJsonTextFormat(content)
  }

  return null
}

async function getJsonTextFormatForWrite(
  dir: FileSystemDirectoryHandle,
  filename: string,
): Promise<{ oldContent: string | null; format: JsonTextFormat }> {
  const oldContent = await readJsonFileText(dir, filename)
  if (oldContent !== null) {
    try { JSON.parse(oldContent) } catch (error) { throw new Error(`${dir.name}/${filename} 已损坏，未覆盖：${String(error)}`) }
    return { oldContent, format: detectJsonTextFormat(oldContent) }
  }

  return {
    oldContent: null,
    format: await detectDirectoryJsonTextFormat(dir) ?? DEFAULT_JSON_TEXT_FORMAT,
  }
}

/** 只在内容真正变化时才写入，返回是否写了 */
async function writeJsonFileIfChanged(
  dir: FileSystemDirectoryHandle,
  filename: string,
  data: unknown,
  onBeforeWrite?: () => void,
): Promise<boolean> {
  const { oldContent, format } = await getJsonTextFormatForWrite(dir, filename)
  const newContent = formatJsonText(data, format)
  if (oldContent === newContent) return false

  onBeforeWrite?.()
  const fh = await dir.getFileHandle(filename, { create: true })
  const writable = await fh.createWritable()
  try { await writable.write(newContent); await writable.close() }
  catch (error) { await writable.abort().catch(() => {}); throw error }
  return true
}

async function readJsonFile<T>(dir: FileSystemDirectoryHandle, filename: string): Promise<T | null> {
  try {
    const fh = await dir.getFileHandle(filename)
    const file = await fh.getFile()
    const value = JSON.parse(await file.text()) as T
    if (value === null) throw new Error('JSON 内容为 null')
    return value
  } catch (error) {
    if ((error as DOMException)?.name === 'NotFoundError') return null
    throw new Error(`读取 ${dir.name}/${filename} 失败：${String(error)}`)
  }
}

async function listJsonKeys(dir: FileSystemDirectoryHandle): Promise<string[]> {
  const keys: string[] = []
  // @ts-ignore
  for await (const [name] of dir.entries()) {
    if (typeof name === 'string' && name.endsWith('.json')) keys.push(name.slice(0, -5))
  }
  return keys
}

// ── public types ─────────────────────────────────────────────────────────────

export interface ProjectMeta {
  label: string
  version: number
  constFields: Partial<AutoChessSeasonData> & Record<string, unknown>
}

// ── public API ────────────────────────────────────────────────────────────────

export async function openDirectory(): Promise<FileSystemDirectoryHandle | null> {
  try {
    // @ts-expect-error showDirectoryPicker is in modern browsers
    const handle = await window.showDirectoryPicker({ mode: 'readwrite' }) as FileSystemDirectoryHandle
    return handle
  } catch (e: unknown) {
    if (e instanceof DOMException && e.name === 'AbortError') return null
    throw e
  }
}

export interface LoadProgress {
  current: number
  total: number
  /** 当前正在加载的字段 */
  field: string
  phase?: 'scanning' | 'reading' | 'normalizing' | 'done' | 'saving'
}

export class SeasonLoadError extends Error {
  readonly code: string

  constructor(message: string, code: string = 'READ_FAILED') {
    super(message)
    this.name = 'SeasonLoadError'
    this.code = code
  }
}

export function isMissingProject(error: unknown): boolean {
  return error instanceof SeasonLoadError && error.code === 'PROJECT_NOT_FOUND'
}

/** Keep progress messages bounded both in a Worker and on the main thread. */
export function createLoadProgressReporter(onProgress?: (progress: LoadProgress) => void) {
  let lastTime = -Infinity
  let lastPhase: LoadProgress['phase']
  return (progress: LoadProgress) => {
    const now = performance.now()
    if (progress.phase !== lastPhase || progress.phase === 'done' || now - lastTime >= 100) {
      lastTime = now
      lastPhase = progress.phase
      onProgress?.(progress)
    }
  }
}

export interface SeasonLoadOptions {
  signal?: AbortSignal
  /** Used only by the main-thread fallback. */
  yieldToMainThread?: boolean
}

export function parseSeasonJson(text: string, path: string): unknown {
  try {
    const value: unknown = JSON.parse(text)
    if (value === null) throw new Error('JSON 内容为 null')
    return value
  } catch (error) {
    throw new SeasonLoadError(`${path} JSON 解析失败：${String(error)}`, 'INVALID_JSON')
  }
}

async function readJsonHandle(handle: FileSystemFileHandle, path: string): Promise<unknown> {
  let text: string
  try {
    text = await (await handle.getFile()).text()
  } catch (error) {
    if ((error as DOMException)?.name === 'NotFoundError') {
      throw new SeasonLoadError(`${path} 在读取过程中消失，请重新加载`)
    }
    throw new SeasonLoadError(`读取 ${path} 失败：${String(error)}`)
  }
  return parseSeasonJson(text, path)
}

export async function loadFromDirectory(
  dir: FileSystemDirectoryHandle,
  onProgress?: (progress: LoadProgress) => void,
  options: SeasonLoadOptions = {},
): Promise<{ data: AutoChessSeasonData; meta: ProjectMeta }> {
  const report = createLoadProgressReporter(progress => {
    if (!options.signal?.aborted) onProgress?.(progress)
  })
  options.signal?.throwIfAborted()
  report({ current: 0, total: 0, field: 'project.json', phase: 'scanning' })
  let projectHandle: FileSystemFileHandle
  try {
    projectHandle = await dir.getFileHandle('project.json')
  } catch (error) {
    if ((error as DOMException)?.name === 'NotFoundError') {
      throw new SeasonLoadError('目录中不存在 project.json，请先保存一次或选择正确的目录', 'PROJECT_NOT_FOUND')
    }
    throw new SeasonLoadError(`读取 ${dir.name}/project.json 失败：${String(error)}`)
  }
  const meta = await readJsonHandle(projectHandle, `${dir.name}/project.json`) as ProjectMeta
  if (!meta.constFields || typeof meta.constFields !== 'object' || Array.isArray(meta.constFields)) {
    throw new SeasonLoadError('project.json.constFields 损坏：应为对象', 'INVALID_DATA')
  }

  // Enumerate each directory once and reuse the returned file handles.
  const groups = await Promise.all(DICT_FIELDS.map(async field => {
    const files: { key: string; handle: FileSystemFileHandle; path: string }[] = []
    let subDir: FileSystemDirectoryHandle
    try {
      options.signal?.throwIfAborted()
      subDir = await dir.getDirectoryHandle(field)
    } catch (error) {
      if ((error as DOMException)?.name === 'NotFoundError') return { field, files }
      throw error instanceof DOMException && error.name === 'AbortError'
        ? error : new SeasonLoadError(`扫描 ${field} 失败：${String(error)}`)
    }
    try {
      // @ts-ignore File System Access async iterators are not in lib.dom yet.
      for await (const [name, entry] of subDir.entries()) {
        options.signal?.throwIfAborted()
        if (entry.kind !== 'file' || !name.endsWith('.json')) continue
        files.push({
          key: name.slice(0, -5),
          // The fallback also supports the existing in-memory directory adapters.
          handle: typeof entry.getFile === 'function' ? entry : await subDir.getFileHandle(name),
          path: `${field}/${name}`,
        })
      }
    } catch (error) {
      throw error instanceof DOMException && error.name === 'AbortError'
        ? error : new SeasonLoadError(`扫描 ${field} 失败：${String(error)}`)
    }
    return { field, files }
  }))

  const data: Record<string, unknown> = { ...meta.constFields }
  for (const group of groups) data[group.field] = {}
  // Interleave fields so the global limit does not starve the later directories.
  const tasks: { field: string; key: string; handle: FileSystemFileHandle; path: string }[] = []
  const maxFiles = Math.max(0, ...groups.map(group => group.files.length))
  for (let i = 0; i < maxFiles; i++) {
    for (const group of groups) {
      const file = group.files[i]
      if (file) tasks.push({ field: group.field, ...file })
    }
  }

  const total = tasks.length
  let current = 0
  let nextTask = 0
  let failure: unknown
  let lastYield = performance.now()
  let yieldPromise: Promise<void> | undefined
  report({ current, total, field: '', phase: 'reading' })
  await Promise.all(Array.from({ length: Math.min(16, total) }, async () => {
    try {
      while (!failure && nextTask < total) {
        options.signal?.throwIfAborted()
        const task = tasks[nextTask++]
        const value = await readJsonHandle(task.handle, task.path)
        options.signal?.throwIfAborted()
        if (failure) return
        ;(data[task.field] as Record<string, unknown>)[task.key] = value
        report({ current: ++current, total, field: task.field, phase: 'reading' })
        if (options.yieldToMainThread && performance.now() - lastYield >= 8) {
          yieldPromise ??= new Promise<void>(resolve => setTimeout(() => {
            lastYield = performance.now()
            yieldPromise = undefined
            resolve()
          }, 0))
          await yieldPromise
        }
      }
    } catch (error) {
      failure ??= error
    }
  }))
  if (failure) throw failure
  options.signal?.throwIfAborted()
  report({ current, total, field: '', phase: 'normalizing' })
  if (options.yieldToMainThread) await new Promise<void>(resolve => setTimeout(resolve, 0))
  options.signal?.throwIfAborted()
  const runtimeData = normalizeSeasonDataForRuntime(data as unknown as AutoChessSeasonData)
  report({ current, total, field: '', phase: 'done' })
  return { data: runtimeData, meta }
}

export interface SaveProgress {
  current: number
  total: number
  /** 变动的顶层字段名列表 */
  changedFields: string[]
}

export async function saveToDirectory(
  dir: FileSystemDirectoryHandle,
  data: AutoChessSeasonData,
  label: string,
  /** 第一个文件实际写入前调用，用于提前更新 lastOwnWrite，避免 watchDirectory 误判 */
  onFirstWrite?: () => void,
  /** 进度回调 */
  onProgress?: (progress: SaveProgress) => void,
  /** 上次保存的数据，用于增量保存（只写变化的字段） */
  lastSavedData?: AutoChessSeasonData,
): Promise<number> {
  // Validate the entire existing project before the first write, including files slated for removal.
  await readJsonFile(dir, 'project.json')
  for (const field of DICT_FIELDS) {
    let subDir: FileSystemDirectoryHandle
    try { subDir = await dir.getDirectoryHandle(field) }
    catch (error) { if ((error as DOMException)?.name === 'NotFoundError') continue; throw error }
    for (const key of await listJsonKeys(subDir)) await readJsonFile(subDir, `${key}.json`)
  }
  const normalizedData = normalizeSeasonDataForDirectory(data)
  const normalizedBase = lastSavedData ? normalizeSeasonDataForDirectory(lastSavedData) : null
  const constFields = getProjectConstFields(normalizedData)
  let firstWriteCalled = false
  const notifyFirst = () => {
    if (!firstWriteCalled) {
      firstWriteCalled = true
      onFirstWrite?.()
    }
  }

  // Determine which top-level fields actually changed
  const changedDictFields = new Set<keyof AutoChessSeasonData>()
  const constFieldsChanged = !normalizedBase
    || JSON.stringify(deepSortValue(constFields)) !== JSON.stringify(deepSortValue(getProjectConstFields(normalizedBase)))
  if (normalizedBase) {
    for (const field of DICT_FIELDS) {
      const newVal = (normalizedData as unknown as Record<string, unknown>)[field]
      const oldVal = (normalizedBase as unknown as Record<string, unknown>)[field]
      if (JSON.stringify(deepSortValue(newVal)) !== JSON.stringify(deepSortValue(oldVal))) {
        changedDictFields.add(field)
      }
    }
  } else {
    // No base data = first save, write everything
    for (const field of DICT_FIELDS) changedDictFields.add(field)
  }

  // 即使增量基线没有变化，也要保存标签，并修复旧编辑器白名单漏写的字段。
  const projectChanged = await writeJsonFileIfChanged(
    dir, 'project.json', { label, version: 1, constFields }, notifyFirst,
  )

  // Build changed fields list for display
  const changedFields: string[] = []
  if (constFieldsChanged || projectChanged) changedFields.push('project.json')
  for (const field of changedDictFields) changedFields.push(field as string)

  // Count total files for progress (only changed fields)
  let total = changedFields.includes('project.json') ? 1 : 0
  for (const field of changedDictFields) {
    const dict = (normalizedData as unknown as Record<string, unknown>)[field] as Record<string, unknown> | null
    if (dict) total += Object.keys(dict).length
  }

  let current = 0

  if (changedFields.includes('project.json')) {
    current++
    onProgress?.({ current, total, changedFields })
  }

  for (const field of changedDictFields) {
    // 删除可选字典时同样清理已有文件，防止重载时恢复已移除的效果。
    const dict = ((normalizedData as unknown as Record<string, unknown>)[field] ?? {}) as Record<string, unknown>
    const subDir = await getOrCreateDir(dir, field as string)

    // 写入/更新现有 key
    for (const [key, value] of Object.entries(dict)) {
      await writeJsonFileIfChanged(subDir, `${key}.json`, value, notifyFirst)
      current++
      onProgress?.({ current, total, changedFields })
    }

    // 删除 dict 中已不存在的文件
    const currentKeys = new Set(Object.keys(dict))
    // @ts-ignore
    for await (const [name] of subDir.entries()) {
      if (typeof name === 'string' && name.endsWith('.json')) {
        const key = name.slice(0, -5)
        if (!currentKeys.has(key)) {
          notifyFirst()
          await subDir.removeEntry(name)
        }
      }
    }
  }
  return Date.now()
}

// ── FileSystemObserver with poll fallback ────────────────────────────────────

/**
 * 观察目录变更。
 * 优先使用 FileSystemObserver（Chrome 129+）；不支持时降级为 3s poll。
 *
 * @param dir              目录句柄
 * @param getLastOwnWrite  返回我们自己最近一次完成写入的时间戳（ms），0 表示从未写过
 * @param onExternal       确认是外部变更时的回调
 * @returns                取消观察的函数
 *
 * 过滤策略：
 *   收到通知时，若距离 getLastOwnWrite() 不足 COOLDOWN_MS，则认为是我们自己写的，忽略。
 *   Observer 模式额外加 debounce，避免批量写入触发多次。
 */
const COOLDOWN_MS = 5000 // 自己写完后 5s 内的通知一律忽略

export function watchDirectory(
  dir: FileSystemDirectoryHandle,
  getLastOwnWrite: () => number,
  onExternal: () => void
): () => void {
  const isRecent = () => Date.now() - getLastOwnWrite() < COOLDOWN_MS

  // ── 优先：FileSystemObserver ─────────────────────────────────────────────
  // @ts-expect-error FileSystemObserver is experimental
  if (typeof FileSystemObserver !== 'undefined') {
    let cancelled = false
    let debounceTimer: ReturnType<typeof setTimeout> | null = null

    // @ts-expect-error
    const observer = new FileSystemObserver((records: unknown[]) => {
      // @ts-expect-error
      if (cancelled || !records.find(v => v.changedHandle.name.endsWith('.json') && v.relativePathComponents[0] !== '.git')) return
      // debounce：等 1s 内无新通知再判断
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        debounceTimer = null
        if (!cancelled && !isRecent()) onExternal()
      }, 1000)
    })

    observer.observe(dir, { recursive: true }).catch(() => {
      alert('FileSystemObserver 初始化失败')
    })

    return () => {
      cancelled = true
      if (debounceTimer) clearTimeout(debounceTimer)
      observer.disconnect()
    }
  } else {
    alert('当前浏览器太老，请使用 Chrome 129+')
  }
}
