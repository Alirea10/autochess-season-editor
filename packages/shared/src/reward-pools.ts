import type { AutoChessSeasonData } from './season-data'
import { characterNameMap } from './misc-game-data'
import { legacyRewardPools, resolveRewardPools, type RewardPool } from './reward-pool-defaults'

export { legacyRewardPools, resolveRewardPools } from './reward-pool-defaults'
export type { RewardPool } from './reward-pool-defaults'

export interface RewardPoolRule {
  source: 'all' | 'shop'
  kind: 'char' | 'equip' | 'magic' | 'all'
  quality: 'normal' | 'golden' | 'all'
  visibility: 'visible' | 'hidden' | 'all'
  levels: number[]
  bondIds: string[]
  excludeIds: string[]
  weight: number
  weightOverrides: Record<string, number>
}

export const equipmentLevelPoolRule = (level = 3): RewardPoolRule => ({
  source: 'shop',
  kind: 'equip',
  quality: 'normal',
  visibility: 'visible',
  levels: [level],
  bondIds: [],
  excludeIds: [],
  weight: 1,
  weightOverrides: {},
})

export const REWARD_POOL_RECIPES: Record<string, string> = {
  pool_chess_glady: '斯卡蒂、幽灵鲨、安哲拉；安哲拉不存在时使用深巡，等权。',
  pool_equip_rockr: '维式重锤及灼燃、坚固、加速、战栗维式重锤，等权。',
  pool_equip_vict: '维式重锤及灼燃、坚固、加速、战栗维式重锤，等权。',
  pool_equip_pepe: '盟约之币、萨尔贡浓茶、黄沙罗盘，权重 100、100、10。',
  pool_equip_normal: '全部非金色装备（EQUIP），包含隐藏或未上架装备，等权。',
  pool_equip_shop_1:
    '非隐藏、等级 ≤ 1 的商店装备；排除强化维式重锤和突变细胞。默认全员装备奖励还受商店库存限制。',
  pool_equip_kathe: '全部非金色装备（EQUIP），包含隐藏或未上架装备，等权。',
  pool_equip_narant: '全部非金色装备（EQUIP），包含隐藏或未上架装备，等权。',
  pool_char_pinus: '灰毫、野鬃、远牙，等权。',
  pool_char_later: '非隐藏、等级 ≥ 4、属于拉特兰盟约的商店干员，奖励其存在的金色版本，等权。',
  ...Object.fromEntries(
    [1, 2, 4, 5].map((level) => [
      `pool_chess_shop_${level}_reward`,
      `非隐藏的 ${level} 级商店干员，等权。`,
    ]),
  ),
}

export interface PoolIssue {
  path: string
  message: string
}
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v)
const weight = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0
const strings = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((x) => typeof x === 'string' && x.length > 0)

export function rewardPoolRuleIssues(data: AutoChessSeasonData): PoolIssue[] {
  const rules = data.runtimeConfig?.rewardPoolRules
  if (rules === undefined) return []
  const root = 'runtimeConfig.rewardPoolRules'
  if (!object(rules)) return [{ path: root, message: '规则必须为池名字典' }]
  const issues: PoolIssue[] = []
  for (const [id, rule] of Object.entries(rules)) {
    const path = `${root}.${id}`
    if (!object(rule)) {
      issues.push({ path, message: '规则必须为对象' })
      continue
    }
    const choices: Record<string, string[]> = {
      source: ['all', 'shop'],
      kind: ['all', 'char', 'equip', 'magic'],
      quality: ['all', 'normal', 'golden'],
      visibility: ['all', 'visible', 'hidden'],
    }
    for (const [field, values] of Object.entries(choices))
      if (!values.includes(rule[field] as string))
        issues.push({ path: `${path}.${field}`, message: '请选择有效选项' })
    if (!Array.isArray(rule.levels) || !rule.levels.every((v) => Number.isSafeInteger(v) && v >= 0))
      issues.push({ path: `${path}.levels`, message: '等级必须为非负整数列表' })
    for (const field of ['bondIds', 'excludeIds'])
      if (!strings(rule[field]))
        issues.push({ path: `${path}.${field}`, message: '必须为非空 ID 字符串列表' })
    if (Array.isArray(rule.bondIds) && rule.bondIds.length && rule.kind !== 'char')
      issues.push({ path: `${path}.bondIds`, message: '盟约筛选仅用于干员' })
    if (!weight(rule.weight))
      issues.push({ path: `${path}.weight`, message: '权重必须为有限非负数' })
    if (!object(rule.weightOverrides))
      issues.push({ path: `${path}.weightOverrides`, message: '权重覆盖必须为字典' })
    else
      for (const [chessId, value] of Object.entries(rule.weightOverrides))
        if (!weight(value))
          issues.push({
            path: `${path}.weightOverrides.${chessId}`,
            message: '权重必须为有限非负数',
          })
  }
  return issues
}

export interface RewardPoolCandidate {
  id: string
  name: string
  kind: 'char' | 'equip' | 'magic'
  golden: boolean
  level?: number
  hidden?: boolean
  inShop: boolean
  bondIds: string[]
}

/** Use real pair links, never an ID suffix, to recover the normal shop record. */
export function rewardPoolCandidates(data: AutoChessSeasonData): RewardPoolCandidate[] {
  const charShops = new Map<string, AutoChessSeasonData['charShopChessDatas'][string]>()
  const trapShops = new Map<string, AutoChessSeasonData['trapShopChessDatas'][string]>()
  for (const shop of Object.values(data.charShopChessDatas ?? {})) {
    charShops.set(shop.chessId, shop)
    if (shop.goldenChessId) charShops.set(shop.goldenChessId, shop)
  }
  for (const shop of Object.values(data.trapShopChessDatas ?? {})) {
    trapShops.set(shop.itemId, shop)
    if (shop.goldenItemId) trapShops.set(shop.goldenItemId, shop)
  }
  const result: RewardPoolCandidate[] = []
  // Directory data omits bondIds; derive memberships from the authoritative bond table.
  const memberships = new Map<string, string[]>()
  for (const [id, bond] of Object.entries(data.bondInfoDict ?? {}))
    for (const chessId of bond.chessIdList ?? [])
      memberships.set(chessId, [...(memberships.get(chessId) ?? []), id])
  for (const [id, chess] of Object.entries(data.charChessDataDict ?? {})) {
    const normalId = data.chessNormalIdLookupDict?.[id]
    const shop = charShops.get(id)
    const charId = shop?.charId ?? shop?.backupCharId
    result.push({
      id,
      name: (charId && characterNameMap[charId as keyof typeof characterNameMap]) || id,
      kind: 'char',
      golden: chess.isGolden,
      level: shop?.chessLevel,
      hidden: shop?.isHidden,
      inShop: !!shop,
      bondIds: data.bondInfoDict
        ? (memberships.get(id) ?? memberships.get(shop?.chessId ?? normalId) ?? [])
        : (chess.bondIds ?? []),
    })
  }
  for (const [id, chess] of Object.entries(data.trapChessDataDict ?? {})) {
    const shop = trapShops.get(id)
    result.push({
      id,
      name: characterNameMap[chess.charId as keyof typeof characterNameMap] ?? id,
      kind: chess.itemType === 'EQUIP' ? 'equip' : 'magic',
      golden: chess.isGolden,
      level: shop?.itemLevel,
      hidden: shop?.hideInShop,
      inShop: !!shop,
      bondIds: [],
    })
  }
  return [...new Map(result.map((candidate) => [candidate.id, candidate])).values()]
}

export function evaluateRewardPoolRule(
  data: AutoChessSeasonData,
  rule: RewardPoolRule,
): RewardPool {
  return rewardPoolCandidates(data)
    .filter(
      (c) =>
        (rule.source === 'all' || c.inShop) &&
        (rule.kind === 'all' || c.kind === rule.kind) &&
        (rule.quality === 'all' || c.golden === (rule.quality === 'golden')) &&
        (rule.visibility === 'all' ||
          (c.inShop && Boolean(c.hidden) === (rule.visibility === 'hidden'))) &&
        (!rule.levels.length || (c.level !== undefined && rule.levels.includes(c.level))) &&
        (!rule.bondIds.length ||
          (c.kind === 'char' && c.bondIds.some((id) => rule.bondIds.includes(id)))) &&
        !rule.excludeIds.includes(c.id),
    )
    .sort((a, b) => a.id.localeCompare(b.id, 'en'))
    .map((c) => ({
      chessId: c.id,
      value: Object.hasOwn(rule.weightOverrides, c.id) ? rule.weightOverrides[c.id] : rule.weight,
    }))
}

/** Pure save/export projection. Never writes server fallback lists into the season. */
export function compileRewardPools(data: AutoChessSeasonData): AutoChessSeasonData {
  const issues = rewardPoolRuleIssues(data)
  if (issues.length) throw new Error(issues.map((i) => `${i.path}: ${i.message}`).join('\n'))
  const rules = data.runtimeConfig?.rewardPoolRules
  if (!rules || !Object.keys(rules).length) return data
  const pools = { ...data.runtimeConfig?.rewardPools }
  for (const [id, rule] of Object.entries(rules)) {
    const entries = evaluateRewardPoolRule(data, rule)
    if (!Number.isFinite(entries.reduce((sum, row) => sum + row.value, 0)))
      throw new Error(`runtimeConfig.rewardPoolRules.${id}: 权重总和溢出`)
    Object.defineProperty(pools, id, {
      value: entries,
      enumerable: true,
      configurable: true,
      writable: true,
    })
  }
  return { ...data, runtimeConfig: { ...data.runtimeConfig, version: 1, rewardPools: pools } }
}

export function rewardPoolReferences(data: AutoChessSeasonData): { id: string; path: string }[] {
  const refs: { id: string; path: string }[] = []
  const read = (bb: unknown, path: string) => {
    if (!Array.isArray(bb)) return
    bb.forEach((b, i) => {
      if (/^(pool[1-6]?|max_pool)$/.test(b?.key) && typeof b.valueStr === 'string' && b.valueStr)
        refs.push({ id: b.valueStr, path: `${path}.${i}.valueStr` })
    })
  }
  for (const [id, entries] of Object.entries(data.effectBuffInfoDataDict ?? {}))
    if (Array.isArray(entries))
      entries.forEach((e, i) => read(e?.blackboard, `effectBuffInfoDataDict.${id}.${i}.blackboard`))
  for (const [id, garrison] of Object.entries(data.garrisonDataDict ?? {}))
    read(garrison?.blackboard, `garrisonDataDict.${id}.blackboard`)
  return refs
}

export function inspectRewardPools(data: AutoChessSeasonData) {
  const issues = rewardPoolRuleIssues(data)
  // Editing a bond does not rebuild the runtime-only chess.bondIds until export.
  // Preview defaults against the same authoritative membership table as export.
  const memberships = new Map<string, string[]>()
  for (const [id, bond] of Object.entries(data.bondInfoDict ?? {}))
    for (const chessId of bond.chessIdList ?? [])
      memberships.set(chessId, [...(memberships.get(chessId) ?? []), id])
  const previewData = {
    ...data,
    charChessDataDict: Object.fromEntries(
      Object.entries(data.charChessDataDict ?? {}).map(([id, chess]) => [
        id,
        { ...chess, bondIds: memberships.get(id) ?? [] },
      ]),
    ),
  }
  let compiled = previewData
  if (!issues.length) {
    try {
      compiled = compileRewardPools(previewData)
    } catch (error) {
      issues.push({ path: 'runtimeConfig.rewardPoolRules', message: String(error) })
    }
  }
  const sources: Record<string, string> = {}
  const pools = resolveRewardPools(compiled, (path, _code, message, source) => {
    sources[path] = source
    if (_code !== 'reward_pool_default' && _code !== 'reward_pool_declared')
      issues.push({ path, message })
  })
  const references = rewardPoolReferences(data)
  for (const ref of references)
    if (!pools[ref.id]?.some((c) => c.value > 0))
      issues.push({ path: ref.path, message: `${ref.id} 没有可用候选或同名默认池` })
  return { pools, sources, issues, references, compiled, defaults: legacyRewardPools(previewData) }
}
