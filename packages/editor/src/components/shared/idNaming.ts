import type { AutoChessSeasonData, CharShopChessData } from '@autochess-editor/shared'

export function splitId(id: string): string[] { return id.split('_') }
export function joinId(parts: string[]): string { return parts.map(part => part.trim()).join('_') }
export function completeBondId(id: string, autoShip = true): string {
  const value = joinId(splitId(id))
  if (splitId(value).some(part => !part)) return value
  return value && autoShip && !value.endsWith('Ship') ? `${value}Ship` : value
}
export function validateId(id: string, occupied: Iterable<string> = []): string | null {
  if (!id.trim()) return '请填写 ID'
  if (splitId(id).some(part => !part.trim())) return '每个分段都需要填写内容，或删除空段'
  if (/\s/.test(id)) return 'ID 中不能包含空白字符'
  if (['__proto__', 'constructor', 'prototype'].includes(id)) return '此 ID 为保留名称'
  if (new Set(occupied).has(id)) return `ID「${id}」已存在，请修改`
  return null
}
export function parseChessId(id: string) {
  const match = /^chess_([^_]+)_([1-6])_(\d+)_([ab])$/.exec(id)
  return match ? { family: match[1], level: Number(match[2]), sequence: match[3], variant: match[4] } : null
}
export function resolveChessLevel(filter: string, selected?: CharShopChessData): number {
  return /^[1-6]$/.test(filter) ? Number(filter) : selected?.chessLevel ?? 1
}
export function chessOccupiedIds(data: AutoChessSeasonData): string[] {
  return [...new Set([
    ...Object.keys(data.charShopChessDatas ?? {}), ...Object.keys(data.charChessDataDict ?? {}),
    ...Object.keys(data.trapChessDataDict ?? {}), ...Object.keys(data.trapShopChessDatas ?? {}),
    ...Object.keys(data.chessNormalIdLookupDict ?? {}),
    ...Object.values(data.charShopChessDatas ?? {}).map(chess => chess.goldenChessId).filter(Boolean),
  ])]
}
export function validateChessId(id: string, data: AutoChessSeasonData): string | null {
  const occupied = chessOccupiedIds(data)
  return validateId(id, occupied)
    ?? (!id.endsWith('_a') ? '普通版 ID 必须以 _a 结尾，将配对创建 _b 精锐版' : null)
    ?? validateId(id.replace(/_a$/, '_b'), occupied)
}
export function suggestChess(data: AutoChessSeasonData, level: number) {
  const list = Object.values(data.charShopChessDatas ?? {})
    .filter(chess => chess.chessLevel === level && chess.chessType !== 'DIY' && !chess.isHidden)
    .sort((a, b) => a.shopLevelSortId - b.shopLevelSortId || a.chessId.localeCompare(b.chessId, 'en', { numeric: true }))
  const reference = [...list].reverse().find(chess => parseChessId(chess.chessId)?.variant === 'a')
  const parsed = reference ? parseChessId(reference.chessId)! : null
  const family = parsed?.family ?? 'char'
  let number = parsed ? BigInt(parsed.sequence) + 1n : 1n
  const width = parsed?.sequence.length ?? 2
  const occupied = new Set(chessOccupiedIds(data))
  let id: string
  do { id = `chess_${family}_${level}_${String(number++).padStart(width, '0')}_a` }
  while (occupied.has(id) || occupied.has(id.replace(/_a$/, '_b')))
  return { id, level, sort: Math.max(0, ...list.map(chess => chess.shopLevelSortId)) + 1, referenceId: reference?.chessId }
}
export function matchingChessBond(id: string, data: AutoChessSeasonData): string | null {
  const family = parseChessId(id)?.family
  const bond = family && family !== 'char' ? `${family}Ship` : ''
  return bond && Object.hasOwn(data.bondInfoDict ?? {}, bond) ? bond : null
}
export function bindChessPair(data: AutoChessSeasonData, id: string, bondId: string | null): AutoChessSeasonData {
  if (!bondId || !Object.hasOwn(data.bondInfoDict, bondId)) return data
  const bond = data.bondInfoDict[bondId]
  return { ...data, bondInfoDict: { ...data.bondInfoDict, [bondId]: {
    ...bond, chessIdList: [...new Set([...bond.chessIdList, id, id.replace(/_a$/, '_b')])],
  } } }
}
export function suggestGarrison(ids: Iterable<string>): string {
  let max = 0n
  let width = 2
  for (const id of ids) {
    const match = /^garrison_(\d+)_[a-z]+$/.exec(id)
    if (match) { max = BigInt(match[1]) > max ? BigInt(match[1]) : max; width = Math.max(width, match[1].length) }
  }
  return `garrison_${String(max + 1n).padStart(width, '0')}_a`
}
export function nextLetters(value: string): string {
  const letters = value.split('')
  for (let i = letters.length - 1; i >= 0; i--) {
    if (letters[i] !== 'z') { letters[i] = String.fromCharCode(letters[i].charCodeAt(0) + 1); return letters.join('') }
    letters[i] = 'a'
  }
  return `a${letters.join('')}`
}
export function suggestGarrisonCopy(id: string, ids: Iterable<string>): string {
  const match = /^(.+_[^_]+)_([a-z]+)$/.exec(id)
  if (!match) return id
  const prefix = match[1]
  let suffix = match[2]
  const occupied = new Set(ids)
  do { suffix = nextLetters(suffix) } while (occupied.has(`${prefix}_${suffix}`))
  return `${prefix}_${suffix}`
}
