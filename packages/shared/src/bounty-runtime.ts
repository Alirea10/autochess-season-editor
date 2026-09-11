/** Shared ENEMY_GAIN parsing for server execution, client preload and editor previews. */
export interface BountySpawn {
    effectId: string
    entryIndex: number
    key: string
    enemyId: string
    count: number
    coin: number
    rounds: number
    rewardType: 'kill' | 'win'
}
export const BOUNTY_GENERATORS: Record<string, 'kill' | 'win'> = {
    add_enemy_kill_gain_coin: 'kill',
    add_enemy_win_gain_coin: 'win',
    add_enemy_selfbattle_win_gain_coin: 'win',
    next_battle_add_enemy_win_gain_coin: 'win',
}
export function parseBountyEffects(
    season: any,
    report: (path: string, message: string) => void = () => {},
): Record<string, { price: number; spawns: BountySpawn[] }> {
    const result: Record<string, { price: number; spawns: BountySpawn[] }> = {}
    for (const [effectId, effect] of Object.entries(season.effectInfoDataDict ?? {}) as [
        string,
        any,
    ][]) {
        if (effect?.effectType !== 'ENEMY_GAIN') continue
        const spawns: BountySpawn[] = []
        const entries = season.effectBuffInfoDataDict?.[effectId]
        if (!Array.isArray(entries)) {
            report(`effectBuffInfoDataDict.${effectId}`, '悬赏没有效果条目')
            continue
        }
        entries.forEach((entry: any, entryIndex: number) => {
            const path = `effectBuffInfoDataDict.${effectId}.${entryIndex}`
            const rewardType = Object.hasOwn(BOUNTY_GENERATORS, entry?.key)
                ? BOUNTY_GENERATORS[entry.key]
                : undefined
            if (!rewardType) {
                report(path, `未支持的悬赏生成 key: ${entry?.key ?? ''}；此条目不执行`)
                return
            }
            if (
                !Array.isArray(entry.blackboard) ||
                entry.blackboard.some((b: any) => !b || typeof b.key !== 'string')
            ) {
                report(path + '.blackboard', '参数不是数组')
                return
            }
            const bb = Object.fromEntries(
                entry.blackboard.map((b: any) => [b.key, b.valueStr ?? b.value]),
            )
            const ids =
                typeof bb.enemy_id === 'string'
                    ? [...new Set(bb.enemy_id.split(/[,|;\s]+/).filter(Boolean))]
                    : []
            const count = bb.count ?? 1,
                coin = bb.coin ?? 0
            const rounds = bb.round ?? (entry.key === 'next_battle_add_enemy_win_gain_coin' ? 1 : 2)
            if (
                !ids.length ||
                ids.some((id) => !/^enemy_[a-z0-9_]+$/i.test(id)) ||
                !Number.isSafeInteger(count) ||
                count < 0 ||
                count > 4096 ||
                typeof coin !== 'number' ||
                !Number.isFinite(coin) ||
                coin < 0 ||
                !Number.isSafeInteger(rounds) ||
                rounds < 0
            ) {
                report(path + '.blackboard', 'enemy_id、count、coin 或 round 无效；停用此条目')
                return
            }
            if (!count || !rounds) return
            for (const enemyId of ids)
                spawns.push({
                    effectId,
                    entryIndex,
                    key: entry.key,
                    enemyId,
                    count,
                    coin,
                    rounds,
                    rewardType,
                })
        })
        if (spawns.length && Number.isFinite(effect.enemyPrice) && effect.enemyPrice >= 0)
            result[effectId] = { price: effect.enemyPrice, spawns }
        else if (spawns.length)
            report(`effectInfoDataDict.${effectId}.enemyPrice`, '悬赏费用无效，停用此候选')
    }
    return result
}
