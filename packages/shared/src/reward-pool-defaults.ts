import type { AutoChessSeasonData } from './season-data'
// Server recipe IDs, pinned independently of editor display-name translations.
const characterNameMap: Record<string, string> = {
  char_263_skadi: '斯卡蒂',
  char_143_ghost: '幽灵鲨',
  char_218_cuttle: '安哲拉',
  char_4137_udflow: '深巡',
  char_431_ashlok: '灰毫',
  char_496_wildmn: '野鬃',
  char_430_fartth: '远牙',
  trap_1041_acarm041: '维式重锤',
  trap_1042_acarm042: '灼燃维式重锤',
  trap_1043_acarm043: '坚固维式重锤',
  trap_1044_acarm044: '加速维式重锤',
  trap_1045_acarm045: '战栗维式重锤',
  trap_1066_acarm066: '盟约之币',
  trap_1050_acarm050: '萨尔贡浓茶',
  trap_1103_acarm103: '黄沙罗盘',
}

export type RewardPool = { chessId: string; value: number }[]

/** Compatibility recipes use only entities still present in this season. */
export function legacyRewardPools(data: AutoChessSeasonData): Record<string, RewardPool> {
  const ids = new Map<string, string>()
  for (const c of Object.values(data.charShopChessDatas)) {
    if (c.charId) ids.set(c.charId, c.chessId)
    if (c.backupCharId) ids.set(c.backupCharId, c.chessId)
  }
  for (const c of Object.values(data.trapShopChessDatas)) ids.set(c.trapId, c.itemId)
  const names = new Map<string, string>(
    Object.entries(characterNameMap)
      .reverse()
      .map(([id, name]) => [name, id]),
  )
  const exists = (id: string) => !!(data.charChessDataDict[id] ?? data.trapChessDataDict[id])
  const byName = (name: string) => {
    const id = names.get(name)
    const chessId = id && (ids.get(id) ?? id)
    return chessId && exists(chessId) ? chessId : undefined
  }
  const pool = (ids: string[], value = 1): RewardPool => ids.map((chessId) => ({ chessId, value }))
  const named = (...names: string[]) => pool(names.map(byName).filter((id): id is string => !!id))
  const equip = pool(
    Object.values(data.trapChessDataDict)
      .filter((c) => c.itemType === 'EQUIP' && !c.isGolden)
      .map((c) => c.chessId),
  )
  const hammer = named('维式重锤', '灼燃维式重锤', '坚固维式重锤', '加速维式重锤', '战栗维式重锤')
  return {
    pool_chess_glady: named('斯卡蒂', '幽灵鲨', byName('安哲拉') ? '安哲拉' : '深巡'),
    pool_equip_rockr: hammer,
    pool_equip_vict: hammer,
    pool_equip_pepe: [
      ...named('盟约之币', '萨尔贡浓茶').map((c) => ({ ...c, value: 100 })),
      ...named('黄沙罗盘').map((c) => ({ ...c, value: 10 })),
    ],
    pool_equip_normal: equip,
    pool_equip_shop_1: pool(
      Object.values(data.trapShopChessDatas)
        .filter(
          (c) =>
            !c.hideInShop &&
            c.itemType === 'EQUIP' &&
            c.itemLevel <= 1 &&
            !/\S+维式重锤/.test(characterNameMap[c.trapId]) &&
            c.trapId !== 'trap_1072_acarm072',
        )
        .map((c) => c.itemId),
    ),
    pool_equip_kathe: equip,
    pool_equip_narant: equip,
    pool_char_pinus: named('灰毫', '野鬃', '远牙'),
    pool_char_later: pool(
      Object.values(data.charShopChessDatas)
        .filter(
          (c) =>
            !c.isHidden &&
            c.chessLevel >= 4 &&
            c.goldenChessId &&
            exists(c.goldenChessId) &&
            data.charChessDataDict[c.chessId]?.bondIds.includes('lateranoShip'),
        )
        .map((c) => c.goldenChessId!),
    ),
    ...Object.fromEntries(
      [1, 2, 4, 5].map((level) => [
        `pool_chess_shop_${level}_reward`,
        pool(
          Object.values(data.charShopChessDatas)
            .filter((c) => !c.isHidden && c.chessLevel === level)
            .map((c) => c.chessId),
        ),
      ]),
    ),
  }
}

export function resolveRewardPools(
  data: AutoChessSeasonData,
  report: (
    path: string,
    code: string,
    message: string,
    source: 'season' | 'legacy-default' | 'disabled',
  ) => void,
) {
  const defaults = legacyRewardPools(data)
  const result: Record<string, RewardPool> = Object.assign(Object.create(null), defaults)
  const declared = data.runtimeConfig?.rewardPools
  for (const name of Object.keys(defaults))
    report(
      `runtimeConfig.rewardPools.${name}`,
      'reward_pool_default',
      '未声明的奖励池采用兼容配方。',
      'legacy-default',
    )
  if (declared === undefined) return result
  if (!declared || typeof declared !== 'object' || Array.isArray(declared)) {
    report(
      'runtimeConfig.rewardPools',
      'invalid_reward_pools',
      '奖励池必须为字典，采用逐池兼容值。',
      'legacy-default',
    )
    return result
  }
  for (const [name, entries] of Object.entries(declared)) {
    const defaultPool = Object.hasOwn(defaults, name) ? defaults[name] : undefined
    const path = `runtimeConfig.rewardPools.${name}`
    if (!Array.isArray(entries)) {
      result[name] = defaultPool ?? []
      report(
        path,
        'invalid_reward_pool',
        '奖励池必须为数组；无同名兼容池时停用。',
        defaultPool ? 'legacy-default' : 'disabled',
      )
      continue
    }
    result[name] = []
    report(path, 'reward_pool_declared', '采用赛季奖励池。', 'season')
    for (const [i, row] of entries.entries()) {
      if (
        !row ||
        typeof row.chessId !== 'string' ||
        !(data.charChessDataDict[row.chessId] ?? data.trapChessDataDict[row.chessId])
      ) {
        report(`${path}.${i}`, 'unknown_pool_chess', '奖励棋子不存在，停用此条目。', 'disabled')
        continue
      }
      const fallback = defaultPool?.find((c) => c.chessId === row.chessId)
      const valid = typeof row.value === 'number' && Number.isFinite(row.value) && row.value >= 0
      if (!valid)
        report(
          `${path}.${i}.value`,
          'invalid_pool_weight',
          '权重必须为有限非负数。',
          fallback ? 'legacy-default' : 'disabled',
        )
      if (valid || fallback)
        result[name].push({
          chessId: row.chessId,
          value: valid ? row.value : fallback!.value,
        })
    }
    if (!Number.isFinite(result[name].reduce((sum, c) => sum + c.value, 0))) {
      result[name] = defaultPool ?? []
      report(
        path,
        'pool_weight_overflow',
        '权重总和溢出；采用同名兼容池，无兼容池时停用。',
        defaultPool ? 'legacy-default' : 'disabled',
      )
    }
    if (!result[name].some((c) => c.value > 0)) {
      result[name] = defaultPool ?? []
      const available = result[name].some((c) => c.value > 0)
      report(
        path,
        'reward_pool_empty_fallback',
        available
          ? '赛季池没有有效正权重候选，采用同名兼容池。'
          : '赛季池没有有效正权重候选，且无可用同名兼容池；不发奖励。',
        available ? 'legacy-default' : 'disabled',
      )
    }
  }
  return result
}
