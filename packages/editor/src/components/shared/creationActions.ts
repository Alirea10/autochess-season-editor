import type { AutoChessSeasonData, BondInfoDict, CharChessDataDict, CharShopChessData, EffectInfoDataDict, GarrisonDataDict } from '@autochess-editor/shared'
import { normalizeSeasonDataForRuntime } from '@autochess-editor/shared'
import { bindChessPair, validateChessId, validateId } from './idNaming'

function requireValid(error: string | null): void { if (error) throw new Error(error) }
export function createBond(data: AutoChessSeasonData, id: string, defaults: Omit<BondInfoDict, 'bondId'>): AutoChessSeasonData {
  requireValid(validateId(id, Object.keys(data.bondInfoDict)))
  const identifier = Math.max(-1, ...Object.values(data.bondInfoDict).map(bond => bond.identifier)) + 1
  return normalizeSeasonDataForRuntime({ ...data, bondInfoDict: {
    ...data.bondInfoDict, [id]: { ...structuredClone(defaults), bondId: id, identifier },
  } })
}
export function createChessPair(data: AutoChessSeasonData, options: {
  id: string; level: number; sort: number; bondId: string | null
  shop: CharShopChessData; normal: CharChessDataDict; golden: CharChessDataDict
}): AutoChessSeasonData {
  const { id, level, sort, bondId } = options
  requireValid(validateChessId(id, data))
  if (!Number.isInteger(level) || level < 1 || level > 6) throw new Error('星级需要为 1–6 的整数')
  if (/^chess_[^_]+_[^_]*_\d+_a$/.test(id) && Number(id.split('_')[2]) !== level) throw new Error('ID 星级段需要与实际星级一致')
  if (!Number.isInteger(sort) || sort < 0) throw new Error('商店排序需要为非负整数')
  if (bondId && !Object.hasOwn(data.bondInfoDict, bondId)) throw new Error('待绑定的盟约已不存在，请重新选择')
  const goldenId = id.replace(/_a$/, '_b')
  const maxIdentifier = Math.max(-1, ...Object.values(data.charChessDataDict).map(chess => chess.identifier), ...Object.values(data.trapChessDataDict ?? {}).map(chess => chess.identifier))
  return normalizeSeasonDataForRuntime(bindChessPair({ ...data,
    charShopChessDatas: { ...data.charShopChessDatas, [id]: { ...structuredClone(options.shop), chessId: id, goldenChessId: goldenId, chessLevel: level, shopLevelSortId: sort } },
    charChessDataDict: { ...data.charChessDataDict,
      [id]: { ...structuredClone(options.normal), chessId: id, upgradeChessId: goldenId, identifier: maxIdentifier + 1, isGolden: false },
      [goldenId]: { ...structuredClone(options.golden), chessId: goldenId, upgradeChessId: null, identifier: maxIdentifier + 2, isGolden: true },
    },
    chessNormalIdLookupDict: { ...data.chessNormalIdLookupDict, [id]: id, [goldenId]: id },
  }, id, bondId))
}
export function createGarrison(data: AutoChessSeasonData, id: string, defaults: GarrisonDataDict): AutoChessSeasonData {
  requireValid(validateId(id, Object.keys(data.garrisonDataDict)))
  return { ...data, garrisonDataDict: { ...data.garrisonDataDict, [id]: structuredClone(defaults) } }
}
export function copyGarrisonEntry(data: AutoChessSeasonData, source: string, id: string): AutoChessSeasonData {
  const entry = data.garrisonDataDict[source]
  if (!entry) throw new Error('来源特质已不存在，请重新选择')
  return createGarrison(data, id, { ...entry, garrisonDesc: '', description: '' })
}
export function createEffect(data: AutoChessSeasonData, id: string, defaults: Omit<EffectInfoDataDict, 'effectId'>): AutoChessSeasonData {
  requireValid(validateId(id, [...Object.keys(data.effectInfoDataDict), ...Object.keys(data.effectBuffInfoDataDict)]))
  return { ...data, effectInfoDataDict: { ...data.effectInfoDataDict, [id]: { ...structuredClone(defaults), effectId: id } } }
}
export function copyEffectEntry(data: AutoChessSeasonData, source: string, id: string): AutoChessSeasonData {
  const entry = data.effectInfoDataDict[source]
  if (!entry) throw new Error('来源效果已不存在，请重新选择')
  return { ...createEffect(data, id, entry), effectBuffInfoDataDict: {
    ...data.effectBuffInfoDataDict, [id]: structuredClone(data.effectBuffInfoDataDict[source] ?? []),
  } }
}
