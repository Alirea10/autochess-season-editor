import { characterNameMap } from './misc-game-data'
import type {
  AutoChessSeasonData,
  BondInfoDict,
  CharChessDataDict,
  CharShopChessData,
} from './season-data'

const sortCollator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' })

const IDENTIFIER_DICT_FIELDS = new Set<keyof AutoChessSeasonData>([
  'bondInfoDict',
  'charChessDataDict',
  'trapChessDataDict',
])

const PE_REMOVED_BOND_IDS = new Set(['ursusShip'])
const PE_URSUS_CHESS_PREFIX = 'chess_ursus_'
const PE_GUMMY_CHESS_IDS = ['chess_char_1_10_a', 'chess_char_1_10_b']
const PE_ZOYA_CHESS_IDS = ['chess_char_2_17_a', 'chess_char_2_17_b']
const PE_URSUS_BOND_CHESS_KEEP_IDS = new Set([...PE_GUMMY_CHESS_IDS, ...PE_ZOYA_CHESS_IDS])
const PE_SOLO_BOND_ID = 'soloShip'
const PE_REMOVED_EFFECT_ID_PARTS = ['ursus']

function sortKeys(keys: string[]): string[] {
  const getSuffixRank = (key: string) => {
    if (key.endsWith('_a')) return 0
    if (key.endsWith('_b')) return 1
    return 2
  }

  const getBaseKey = (key: string) => key.replace(/_[ab]$/, '')

  return [...keys].sort((a, b) => {
    const suffixRankDiff = getSuffixRank(a) - getSuffixRank(b)
    if (suffixRankDiff !== 0) return suffixRankDiff

    const baseDiff = sortCollator.compare(getBaseKey(a), getBaseKey(b))
    if (baseDiff !== 0) return baseDiff

    return sortCollator.compare(a, b)
  })
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function deepSortValue<T>(value: T): T {
  if (Array.isArray(value)) return value.map(item => deepSortValue(item)) as T
  if (!isPlainObject(value)) return value

  const result: Record<string, unknown> = {}
  for (const key of sortKeys(Object.keys(value))) {
    result[key] = deepSortValue(value[key])
  }
  return result as T
}

function normalizeIdentifierDict<T extends Record<string, unknown>>(
  dict: Record<string, T>,
  includeIdentifier: boolean
): Record<string, T> {
  const result: Record<string, T> = {}
  let identifier = 0

  for (const key of sortKeys(Object.keys(dict))) {
    const { identifier: _ignored, ...rest } = dict[key] as T & { identifier?: number }
    const normalized = includeIdentifier
      ? { ...rest, identifier }
      : rest
    result[key] = deepSortValue(normalized as T)
    identifier += 1
  }

  return result
}

function filterRemovedIds<T extends string>(values: T[] | undefined, removedIds: Set<string>): T[] {
  return (values ?? []).filter(value => !removedIds.has(value))
}

function removeCommaSeparatedIds(value: string | null, removedIds: Set<string>): string | null {
  if (value === null) return null
  const parts = value.split(',').map(part => part.trim())
  if (parts.length <= 1) return removedIds.has(value) ? null : value

  const kept = parts.filter(part => part && !removedIds.has(part))
  return kept.length > 0 ? kept.join(',') : null
}

function collectPeRemovedChessIds(data: AutoChessSeasonData): Set<string> {
  const removedChessIds = new Set<string>()
  const addRemoved = (chessId: string | null | undefined) => {
    if (chessId) removedChessIds.add(chessId)
  }
  const addIfRemoved = (chessId: string | null | undefined) => {
    if (!chessId || PE_URSUS_BOND_CHESS_KEEP_IDS.has(chessId)) return
    if (chessId.startsWith(PE_URSUS_CHESS_PREFIX)) {
      removedChessIds.add(chessId)
      return
    }
    for (const bondId of PE_REMOVED_BOND_IDS) {
      const bond = data.bondInfoDict?.[bondId]
      if (bond?.chessIdList.includes(chessId)) {
        removedChessIds.add(chessId)
        return
      }
    }
  }

  for (const bondId of PE_REMOVED_BOND_IDS) {
    for (const chessId of data.bondInfoDict?.[bondId]?.chessIdList ?? []) {
      addIfRemoved(chessId)
    }
  }

  for (const [key, chess] of Object.entries(data.charChessDataDict ?? {})) {
    addIfRemoved(key)
    addIfRemoved(chess.chessId)
    addIfRemoved(chess.upgradeChessId)
  }

  for (const [key, chess] of Object.entries(data.charShopChessDatas ?? {})) {
    addIfRemoved(key)
    addIfRemoved(chess.chessId)
    addIfRemoved(chess.goldenChessId)
  }

  for (const [key, trap] of Object.entries(data.trapChessDataDict ?? {})) {
    if (
      hasRemovedEffectIdPart(trap.effectId) ||
      (trap.giveBondId !== null && PE_REMOVED_BOND_IDS.has(trap.giveBondId))
    ) {
      addRemoved(key)
      addRemoved(trap.chessId)
      addRemoved(trap.upgradeChessId)
    }
  }

  return removedChessIds
}

function filterPeBondInfoDict(
  dict: Record<string, BondInfoDict>,
  removedChessIds: Set<string>,
  existingChessIds: Set<string>
): Record<string, BondInfoDict> {
  const result: Record<string, BondInfoDict> = {}

  for (const [key, bond] of Object.entries(dict ?? {})) {
    if (PE_REMOVED_BOND_IDS.has(key) || PE_REMOVED_BOND_IDS.has(bond.bondId)) continue

    const chessIdList = filterRemovedIds(bond.chessIdList, removedChessIds)
    if (bond.bondId === PE_SOLO_BOND_ID) {
      for (const chessId of PE_ZOYA_CHESS_IDS) {
        if (existingChessIds.has(chessId) && !chessIdList.includes(chessId)) {
          chessIdList.push(chessId)
        }
      }
    }

    result[key] = { ...bond, chessIdList }
  }

  return result
}

function filterPeCharChessDataDict(
  dict: Record<string, CharChessDataDict>,
  removedChessIds: Set<string>
): Record<string, CharChessDataDict> {
  const result: Record<string, CharChessDataDict> = {}

  for (const [key, chess] of Object.entries(dict ?? {})) {
    if (removedChessIds.has(key) || removedChessIds.has(chess.chessId)) continue
    result[key] = chess.upgradeChessId && removedChessIds.has(chess.upgradeChessId)
      ? { ...chess, upgradeChessId: null, upgradeNum: 0 }
      : chess
  }

  return result
}

function filterPeCharShopChessDatas(
  dict: Record<string, CharShopChessData>,
  removedChessIds: Set<string>
): Record<string, CharShopChessData> {
  const result: Record<string, CharShopChessData> = {}

  for (const [key, chess] of Object.entries(dict ?? {})) {
    if (
      removedChessIds.has(key) ||
      removedChessIds.has(chess.chessId) ||
      removedChessIds.has(chess.goldenChessId)
    ) {
      continue
    }
    result[key] = chess
  }

  return result
}

function filterPeTrapChessDataDict(
  dict: AutoChessSeasonData['trapChessDataDict'],
  removedChessIds: Set<string>
): AutoChessSeasonData['trapChessDataDict'] {
  const result: AutoChessSeasonData['trapChessDataDict'] = {}

  for (const [key, trap] of Object.entries(dict ?? {})) {
    if (removedChessIds.has(key) || removedChessIds.has(trap.chessId)) continue
    const normalizedTrap = trap.upgradeChessId && removedChessIds.has(trap.upgradeChessId)
      ? { ...trap, upgradeChessId: null, upgradeNum: 0 }
      : trap
    result[key] = normalizedTrap.giveBondId && PE_REMOVED_BOND_IDS.has(normalizedTrap.giveBondId)
      ? { ...normalizedTrap, giveBondId: null, canGiveBond: false }
      : normalizedTrap
  }

  return result
}

function filterPeTrapShopChessDatas(
  dict: AutoChessSeasonData['trapShopChessDatas'],
  removedChessIds: Set<string>
): AutoChessSeasonData['trapShopChessDatas'] {
  const result: AutoChessSeasonData['trapShopChessDatas'] = {}

  for (const [key, trap] of Object.entries(dict ?? {})) {
    if (
      removedChessIds.has(key) ||
      removedChessIds.has(trap.itemId) ||
      (trap.goldenItemId !== null && removedChessIds.has(trap.goldenItemId))
    ) {
      continue
    }
    result[key] = trap
  }

  return result
}

function filterPeGarrisonDataDict(
  dict: AutoChessSeasonData['garrisonDataDict']
): AutoChessSeasonData['garrisonDataDict'] {
  const result: AutoChessSeasonData['garrisonDataDict'] = {}

  for (const [key, garrison] of Object.entries(dict ?? {})) {
    result[key] = {
      ...garrison,
      blackboard: garrison.blackboard.map(item => ({
        ...item,
        valueStr: removeCommaSeparatedIds(item.valueStr, PE_REMOVED_BOND_IDS),
      })),
    }
  }

  return result
}

function filterPeModeDataDict(data: AutoChessSeasonData['modeDataDict']): AutoChessSeasonData['modeDataDict'] {
  const result: AutoChessSeasonData['modeDataDict'] = {}

  for (const [key, mode] of Object.entries(data ?? {})) {
    result[key] = {
      ...mode,
      activeBondIdList: filterRemovedIds(mode.activeBondIdList, PE_REMOVED_BOND_IDS),
      inactiveBondIdList: filterRemovedIds(mode.inactiveBondIdList, PE_REMOVED_BOND_IDS),
    }
  }

  return result
}

function filterPeChessNormalIdLookupDict(
  dict: AutoChessSeasonData['chessNormalIdLookupDict'],
  removedChessIds: Set<string>
): AutoChessSeasonData['chessNormalIdLookupDict'] {
  const result: AutoChessSeasonData['chessNormalIdLookupDict'] = {}

  for (const [key, value] of Object.entries(dict ?? {})) {
    if (!removedChessIds.has(key) && !removedChessIds.has(value)) {
      result[key] = value
    }
  }

  return result
}

function hasRemovedEffectIdPart(id: string): boolean {
  return PE_REMOVED_EFFECT_ID_PARTS.some(part => id.toLowerCase().includes(part))
}

function filterPeEffectInfoDataDict(
  dict: AutoChessSeasonData['effectInfoDataDict']
): AutoChessSeasonData['effectInfoDataDict'] {
  const result: AutoChessSeasonData['effectInfoDataDict'] = {}

  for (const [key, effect] of Object.entries(dict ?? {})) {
    if (!hasRemovedEffectIdPart(key) && !hasRemovedEffectIdPart(effect.effectId)) {
      result[key] = effect
    }
  }

  return result
}

function filterPeEffectBuffInfoDataDict(
  dict: AutoChessSeasonData['effectBuffInfoDataDict']
): AutoChessSeasonData['effectBuffInfoDataDict'] {
  const result: AutoChessSeasonData['effectBuffInfoDataDict'] = {}

  for (const [key, effects] of Object.entries(dict ?? {})) {
    if (!hasRemovedEffectIdPart(key)) {
      result[key] = effects
    }
  }

  return result
}

function filterPeBuffTemplates(
  dict: AutoChessSeasonData['buffTemplates']
): AutoChessSeasonData['buffTemplates'] {
  if (!dict) return dict
  const result: NonNullable<AutoChessSeasonData['buffTemplates']> = {}

  for (const [key, template] of Object.entries(dict)) {
    if (!hasRemovedEffectIdPart(key) && !hasRemovedEffectIdPart(template.templateKey)) {
      result[key] = template
    }
  }

  return result
}

function filterPeConstData(data: AutoChessSeasonData['constData']): AutoChessSeasonData['constData'] {
  return {
    ...data,
    trBondIds: filterRemovedIds(data.trBondIds, PE_REMOVED_BOND_IDS),
    trBannedBondIds: filterRemovedIds(data.trBannedBondIds, PE_REMOVED_BOND_IDS),
  }
}

function filterPeBanConfig(config: AutoChessSeasonData['banConfig']): AutoChessSeasonData['banConfig'] {
  if (!config) return config
  return {
    ...config,
    immuneBonds: config.immuneBonds ? filterRemovedIds(config.immuneBonds, PE_REMOVED_BOND_IDS) : config.immuneBonds,
    coreBondIds: config.coreBondIds ? filterRemovedIds(config.coreBondIds, PE_REMOVED_BOND_IDS) : config.coreBondIds,
    minorBondIds: config.minorBondIds ? filterRemovedIds(config.minorBondIds, PE_REMOVED_BOND_IDS) : config.minorBondIds,
  }
}

function buildBondIdsByChessId(bondInfoDict: Record<string, BondInfoDict>): Record<string, string[]> {
  const result: Record<string, string[]> = {}
  const bonds = Object.values(bondInfoDict).sort(
    (a, b) => sortCollator.compare(a.bondId, b.bondId)
  )

  for (const bond of bonds) {
    for (const chessId of bond.chessIdList) {
      result[chessId] ??= []
      result[chessId].push(bond.bondId)
    }
  }

  return result
}

function normalizeChessIdentifierDict<T extends Record<string, unknown>>(
  dict: Record<string, T>,
  identifiersByKey: Record<string, number>,
  includeIdentifier: boolean
): Record<string, T> {
  const result: Record<string, T> = {}

  for (const key of sortKeys(Object.keys(dict))) {
    const { identifier: _ignored, ...rest } = dict[key] as T & { identifier?: number }
    const normalized = includeIdentifier
      ? { ...rest, identifier: identifiersByKey[key] }
      : rest
    result[key] = deepSortValue(normalized as T)
  }

  return result
}

function normalizeCharChessDict(
  dict: Record<string, CharChessDataDict>,
  identifiersByKey: Record<string, number>,
  bondIdsByChessId: Record<string, string[]>,
  includeIdentifier: boolean,
  includeBondIds: boolean
): Record<string, CharChessDataDict> {
  const result: Record<string, CharChessDataDict> = {}

  for (const key of sortKeys(Object.keys(dict))) {
    const { identifier: _ignoredIdentifier, bondIds: _ignoredBondIds, ...rest } = dict[key]
    const normalized: CharChessDataDict = {
      ...rest,
      ...(includeIdentifier ? { identifier: identifiersByKey[key] } : {}),
      ...(includeBondIds ? { bondIds: bondIdsByChessId[key] ?? [] } : {}),
    } as CharChessDataDict
    result[key] = deepSortValue(normalized)
  }

  return result
}

export function normalizeIdentifierDictForRuntime<T extends Record<string, unknown>>(
  dict: Record<string, T>
): Record<string, T> {
  return normalizeIdentifierDict(dict, true)
}

export function normalizeIdentifierDictForDirectory<T extends Record<string, unknown>>(
  dict: Record<string, T>
): Record<string, T> {
  return normalizeIdentifierDict(dict, false)
}

function normalizeSeasonData(
  data: AutoChessSeasonData,
  includeIdentifiers: boolean
): AutoChessSeasonData {
  const normalized: Partial<AutoChessSeasonData> = {}
  const bondIdsByChessId = buildBondIdsByChessId(data.bondInfoDict ?? {})

  // Identifier assignment: charChessDataDict and trapChessDataDict use separate ranges.
  // Within charChessDataDict: all _a first (from 0), then all _b (continuing from _a count).
  // trapChessDataDict starts after charChessDataDict ends.
  const charKeys = Object.keys(data.charChessDataDict ?? {})
  const charKeysA = sortKeys(charKeys.filter(k => k.endsWith('_a')))
  const charKeysB = sortKeys(charKeys.filter(k => k.endsWith('_b')))
  const charKeysOther = sortKeys(charKeys.filter(k => !k.endsWith('_a') && !k.endsWith('_b')))
  const charOrderedKeys = [...charKeysA, ...charKeysB, ...charKeysOther]

  const trapKeys = sortKeys(Object.keys(data.trapChessDataDict ?? {}))
  const charBase = 0
  const trapBase = charOrderedKeys.length

  const chessIdentifiersByKey: Record<string, number> = {}
  charOrderedKeys.forEach((key, i) => { chessIdentifiersByKey[key] = charBase + i })
  trapKeys.forEach((key, i) => { chessIdentifiersByKey[key] = trapBase + i })

  for (const key of sortKeys(Object.keys(data)) as (keyof AutoChessSeasonData)[]) {
    const value = data[key]
    ;(normalized as Record<string, unknown>)[key] =
      key === 'charChessDataDict' && isPlainObject(value)
        ? normalizeCharChessDict(value as Record<string, CharChessDataDict>, chessIdentifiersByKey, bondIdsByChessId, includeIdentifiers, includeIdentifiers)
        : key === 'trapChessDataDict' && isPlainObject(value)
          ? normalizeChessIdentifierDict(value as Record<string, Record<string, unknown>>, chessIdentifiersByKey, includeIdentifiers)
          : IDENTIFIER_DICT_FIELDS.has(key) && isPlainObject(value)
            ? normalizeIdentifierDict(value as Record<string, Record<string, unknown>>, includeIdentifiers)
            : deepSortValue(value)
  }

  return normalized as AutoChessSeasonData
}

/** 通过 charId 获取中文名 */
export function getCharName(charId: string | null | undefined): string {
  if (!charId) return '（未知）'
  return (characterNameMap as Record<string, string>)[charId] ?? charId
}

/** 通过 chessId 获取干员中文名（需要 charShopChessDatas + chessNormalIdLookupDict）
 *  _b 金棋子没有 charShopChessDatas 条目，通过 chessNormalIdLookupDict 找回对应 _a
 */
export function getChessName(
  chessId: string,
  charShopChessDatas: Record<string, CharShopChessData>,
  chessNormalIdLookupDict?: Record<string, string>
): string {
  // 先直接查
  const shopData = charShopChessDatas[chessId]
  if (shopData) return getCharName(shopData.charId)
  // 查不到时尝试通过 lookup 找到对应普通棋子
  const normalId = chessNormalIdLookupDict?.[chessId]
  if (normalId) {
    const normalShop = charShopChessDatas[normalId]
    if (normalShop) return getCharName(normalShop.charId)
  }
  return chessId
}

/**
 * 判断一个 chessId 是否为金棋子（_b）
 * 规则：在 charShopChessDatas 中不存在，但在 chessNormalIdLookupDict 中存在
 */
export function isGoldenChess(
  chessId: string,
  charShopChessDatas: Record<string, CharShopChessData>,
  chessNormalIdLookupDict: Record<string, string>
): boolean {
  return !(chessId in charShopChessDatas) && chessId in chessNormalIdLookupDict
}

/** 重新分配 identifier（按当前 Object.values 顺序从 0 开始） */
export function reassignIdentifiers<T extends { identifier: number }>(
  dict: Record<string, T>
): Record<string, T> {
  let i = 0
  const result: Record<string, T> = {}
  for (const [k, v] of Object.entries(dict)) {
    result[k] = { ...v, identifier: i++ }
  }
  return result
}

/** 运行时使用：按稳定顺序重建 identifier，并保证对象键顺序稳定 */
export function normalizeSeasonDataForRuntime(data: AutoChessSeasonData): AutoChessSeasonData {
  return normalizeSeasonData(data, true)
}

/** 导出单文件 JSON：按稳定顺序重建 identifier */
export function normalizeSeasonDataForJson(data: AutoChessSeasonData): AutoChessSeasonData {
  return normalizeSeasonData(data, true)
}

/** PE 兼容导出：移除当前移动端暂不支持的乌萨斯盟约和乌萨斯棋子。 */
export function normalizeSeasonDataForPeJson(data: AutoChessSeasonData): AutoChessSeasonData {
  const normalized = normalizeSeasonData(data, true)
  const removedChessIds = collectPeRemovedChessIds(normalized)
  const keptCharChessDataDict = filterPeCharChessDataDict(normalized.charChessDataDict, removedChessIds)
  const keptChessIds = new Set(Object.keys(keptCharChessDataDict))

  const filtered: AutoChessSeasonData = {
    ...normalized,
    modeDataDict: filterPeModeDataDict(normalized.modeDataDict),
    bondInfoDict: filterPeBondInfoDict(normalized.bondInfoDict, removedChessIds, keptChessIds),
    charChessDataDict: keptCharChessDataDict,
    charShopChessDatas: filterPeCharShopChessDatas(normalized.charShopChessDatas, removedChessIds),
    chessNormalIdLookupDict: filterPeChessNormalIdLookupDict(normalized.chessNormalIdLookupDict, removedChessIds),
    trapChessDataDict: filterPeTrapChessDataDict(normalized.trapChessDataDict, removedChessIds),
    trapShopChessDatas: filterPeTrapShopChessDatas(normalized.trapShopChessDatas, removedChessIds),
    garrisonDataDict: filterPeGarrisonDataDict(normalized.garrisonDataDict),
    effectInfoDataDict: filterPeEffectInfoDataDict(normalized.effectInfoDataDict),
    effectBuffInfoDataDict: filterPeEffectBuffInfoDataDict(normalized.effectBuffInfoDataDict),
    constData: filterPeConstData(normalized.constData),
    banConfig: filterPeBanConfig(normalized.banConfig),
    buffTemplates: filterPeBuffTemplates(normalized.buffTemplates),
  }

  return normalizeSeasonData(filtered, true)
}

/** 保存到目录：移除落盘 identifier，并保证对象键顺序稳定 */
export function normalizeSeasonDataForDirectory(data: AutoChessSeasonData): AutoChessSeasonData {
  return normalizeSeasonData(data, false)
}

/** 清理富文本标签，仅保留纯文本 */
export function stripRichText(text: string): string {
  return text
    .replace(/<[^>]+>/g, '')
    .replace(/\[([^\]]+)\]/g, '$1')
    .trim()
}

/** 难度显示名 */
export const difficultyLabel: Record<string, string> = {
  TRAINING: '训练',
  FUNNY: '标准',
  NORMAL: '普通',
  HARD: '困难',
  ABYSS: '深渊',
}

/** 模式类型显示名 */
export const modeTypeLabel: Record<string, string> = {
  LOCAL: '本地',
  SINGLE: '单人',
  MULTI: '多人',
}

/** 棋子类型显示名 */
export const chessTypeLabel: Record<string, string> = {
  PRESET: '预置',
  NORMAL: '常规',
  DIY: '自选',
}

/** 事件类型显示名 */
export const eventTypeLabel: Record<string, string> = {
  IN_BATTLE: '战斗中',
  SERVER_PRICE: '影响价格',
  SERVER_CHESS_SOLD: '售出时',
  SERVER_GAIN: '获得时',
  SERVER_PREP_FIN: '休整结束时',
  SERVER_PREP_START: '进入休整时',
  SERVER_REFRESH_SHOP: '刷新商店时',
}

/** 效果类型显示名 */
export const effectTypeLabel: Record<string, string> = {
  EQUIP: '装备',
  ENEMY_GAIN: '敌人增益',
  BUFF_GAIN: '增益',
  BAND_INITIAL: '策略',
  CHAR_MAP: '干员属性',
  ENEMY: '敌人',
  BOND: '盟约',
}

/** 激活条件显示名 */
export const activeConditionLabel: Record<string, string> = {
  BOARD_ALL_CHESS: '全棋子',
  BOARD: '场上',
  BOARD_AND_DECK: '场上+整备区',
}

/** 阶段显示名 */
export const evolvePhaseLabel: Record<string, string> = {
  PHASE_0: '未精英',
  PHASE_1: '精英一',
  PHASE_2: '精英二',
}

/** 下载 JSON 文件 */
export function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/** 从 season 中构建 chessId → 中文名映射 */
export function buildChessNameMap(data: AutoChessSeasonData): Record<string, string> {
  const map: Record<string, string> = {}
  for (const [chessId, shopData] of Object.entries(data.charShopChessDatas)) {
    map[chessId] = getCharName(shopData.charId)
  }
  return map
}

/** 从 season 中构建 trapId → 中文名映射 */
export function buildTrapNameMap(data: AutoChessSeasonData): Record<string, string> {
  const map: Record<string, string> = {}
  for (const [chessId, trapData] of Object.entries(data.trapChessDataDict)) {
    map[chessId] = getCharName(trapData.charId)
  }
  return map
}

/** 颜色等级阶显示 */
export const chessLevelColor: Record<number, string> = {
  1: '#9e9e9e',
  2: '#4caf50',
  3: '#2196f3',
  4: '#9c27b0',
  5: '#ff9800',
  6: '#f44336',
}

export const chessLevelLabel: Record<number, string> = {
  1: '一阶',
  2: '二阶',
  3: '三阶',
  4: '四阶',
  5: '五阶',
  6: '六阶',
}
