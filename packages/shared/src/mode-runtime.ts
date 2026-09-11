/** Season mode rules. Mirrored to the editor for default previews. */
export interface DifficultyScaling {
    enemyFactorsByRound?: { maxHp: number; atk: number }[]
    bossHpMultiplier?: number
    bossHpPerPlayer?: boolean
    bossDebtBase?: number
    bossDebtCap?: number
}
export interface BountyGroup {
    minRound?: number
    maxRound?: number
    minPrice?: number
    maxPrice?: number
    count: number
}
export interface ModeRuntime {
    difficultyScaling: Required<DifficultyScaling>
    /** Absent: automatically discover all valid ENEMY_GAIN effects. Empty: no offers. */
    bountyGroups?: BountyGroup[]
}
const legacyExponents: Record<string, number[]> = {
    FUNNY: [1, 2, 3, 7, 7, 7, 8, 10, 10, 11, 12, 13, 14, 14, 16],
    NORMAL: [1, 2, 3, 7, 7, 7, 8, 10, 10, 11, 12, 13, 14, 14, 16],
    HARD: [1, 2, 2, 3, 3, 3, 3, 3, 4, 4, 6, 6, 7, 8, 8],
    ABYSS: [1, 2, 2, 3, 4, 4 * 1.08, 7, 8, 8, 8, 9, 10, 10 * 1.08, 10 * 1.08, 10 * 1.08, 10 * 1.08],
}
export function defaultDifficultyScaling(difficulty: string): Required<DifficultyScaling> {
    return {
        enemyFactorsByRound: (legacyExponents[difficulty] ?? []).map((n) => ({
            maxHp: Math.round(1.2 ** n * 1000) / 1000,
            atk: Math.round(1.1 ** n * 1000) / 1000,
        })),
        bossHpMultiplier: difficulty === 'FUNNY' ? 7 * 1.2 ** 30 : 1,
        bossHpPerPlayer: difficulty !== 'FUNNY',
        bossDebtBase: 1.12,
        bossDebtCap: 3000,
    }
}
const record = (v: any): v is Record<string, any> =>
    !!v && typeof v === 'object' && !Array.isArray(v)
const nonnegative = (v: any): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0
export function resolveModeRuntime(
    mode: any,
    report: (
        path: string,
        message: string,
        source: 'season' | 'legacy-default' | 'disabled',
    ) => void = () => {},
): ModeRuntime {
    const path = `modeDataDict.${mode.modeId}`
    const defaults = defaultDifficultyScaling(mode.modeDifficulty)
    const input = mode.difficultyScaling
    const scaling = record(input) ? input : {}
    if (input !== undefined && !record(input))
        report(path + '.difficultyScaling', '倍率配置不是对象，采用该难度旧规则', 'legacy-default')
    const result = { ...defaults }
    for (const field of [
        'bossHpMultiplier',
        'bossHpPerPlayer',
        'bossDebtBase',
        'bossDebtCap',
    ] as const) {
        if (scaling[field] === undefined) {
            report(path + '.difficultyScaling.' + field, '', 'legacy-default')
            continue
        }
        if (
            field === 'bossHpPerPlayer'
                ? typeof scaling[field] === 'boolean'
                : nonnegative(scaling[field])
        ) {
            ;(result as any)[field] = scaling[field]
            report(path + '.difficultyScaling.' + field, '', 'season')
        } else
            report(
                path + '.difficultyScaling.' + field,
                '字段无效，采用同字段旧值',
                'legacy-default',
            )
    }
    report(
        path + '.difficultyScaling.enemyFactorsByRound',
        '',
        scaling.enemyFactorsByRound === undefined ? 'legacy-default' : 'season',
    )
    if (scaling.enemyFactorsByRound !== undefined) {
        if (!Array.isArray(scaling.enemyFactorsByRound))
            report(
                path + '.difficultyScaling.enemyFactorsByRound',
                '逐回合倍率必须是数组，采用旧表',
                'legacy-default',
            )
        else
            result.enemyFactorsByRound = scaling.enemyFactorsByRound.map((row: any, i: number) => {
                const fallback = defaults.enemyFactorsByRound[i] ?? { maxHp: 1, atk: 1 }
                const resolve = (field: 'maxHp' | 'atk') => {
                    if (record(row) && nonnegative(row[field])) return row[field]
                    report(
                        `${path}.difficultyScaling.enemyFactorsByRound.${i}.${field}`,
                        '倍率无效，采用同回合旧值；没有旧回合时为 1',
                        'legacy-default',
                    )
                    return fallback[field]
                }
                return { maxHp: resolve('maxHp'), atk: resolve('atk') }
            })
    }
    let bountyGroups: BountyGroup[] | undefined
    if (mode.bountyGroups !== undefined) {
        bountyGroups = []
        if (!Array.isArray(mode.bountyGroups))
            report(path + '.bountyGroups', '悬赏分组不是数组，停用候选分组', 'disabled')
        else
            mode.bountyGroups.forEach((group: any, i: number) => {
                if (
                    !record(group) ||
                    !Number.isSafeInteger(group.count) ||
                    group.count < 0 ||
                    group.count > 4096 ||
                    ['minRound', 'maxRound', 'minPrice', 'maxPrice'].some(
                        (k) => group[k] !== undefined && !nonnegative(group[k]),
                    ) ||
                    (group.minRound ?? 0) > (group.maxRound ?? Infinity) ||
                    (group.minPrice ?? 0) > (group.maxPrice ?? Infinity)
                ) {
                    report(
                        `${path}.bountyGroups.${i}`,
                        '悬赏分组范围或数量无效，停用此组',
                        'disabled',
                    )
                    return
                }
                bountyGroups!.push({ ...group } as BountyGroup)
            })
    }
    return { difficultyScaling: result, ...(bountyGroups === undefined ? {} : { bountyGroups }) }
}
