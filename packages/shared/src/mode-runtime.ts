/** Season mode rules. Mirrored to the editor for default previews. */
export interface EnemyFactors {
    maxHp: number
    atk: number
    moveSpeed?: number
}
export interface EnemyGrowthRound {
    maxHpExponent: number
    atkExponent: number
    maxHpMultiplier: number
    atkMultiplier: number
    moveSpeed: number
}
export interface EnemyGrowth {
    maxHpBase: number
    atkBase: number
    rounds: EnemyGrowthRound[]
}
export interface DifficultyScaling {
    enemyGrowth?: EnemyGrowth
    enemyFactorsByRound?: EnemyFactors[]
    bossHpMultiplier?: number
    bossHpPerPlayer?: boolean
    bossDebtBase?: number
    bossDebtCap?: number
}
export interface ResolvedDifficultyScaling extends Required<
    Omit<DifficultyScaling, 'enemyGrowth'>
> {
    enemyGrowth?: EnemyGrowth
    /** Missing in pre-v8 snapshots and direct-factor declarations: out-of-table rounds use 1. */
    enemyFactorsRepeatLast?: boolean
}
export interface BountyGroup {
    minRound?: number
    maxRound?: number
    minPrice?: number
    maxPrice?: number
    count: number
}
export interface ModeRuntime {
    difficultyScaling: ResolvedDifficultyScaling
    /** Absent: automatically discover all valid ENEMY_GAIN effects. Empty: no offers. */
    bountyGroups?: BountyGroup[]
}
const legacyExponents: Record<string, number[]> = {
    FUNNY: [1, 2, 3, 7, 7, 7, 8, 10, 10, 11, 12, 13, 14, 14, 16],
    NORMAL: [1, 2, 3, 7, 7, 7, 8, 10, 10, 11, 12, 13, 14, 14, 16],
    HARD: [1, 2, 2, 3, 3, 3, 3, 3, 4, 4, 6, 6, 7, 8, 8],
    ABYSS: [1, 2, 2, 3, 4, 4 * 1.08, 7, 8, 8, 8, 9, 10, 10 * 1.08, 10 * 1.08, 10 * 1.08, 10 * 1.08],
}
/** Frozen pre-v8 semantics, only for recovering historical snapshots. */
export function legacyDifficultyScaling(difficulty: string): ResolvedDifficultyScaling {
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
const abyssHpExponents = [1, 2, 2, 3, 4, 4, 7, 8, 8, 8, 9, 10, 10, 10, 10]
const abyssAtkExponents = [1, 2, 2, 3, 3, 4, 5, 5, 5, 5, 6, 6, 7, 8, 8]
export function defaultEnemyGrowth(difficulty: string): EnemyGrowth {
    const exponents =
        difficulty === 'ABYSS' ? abyssHpExponents : (legacyExponents[difficulty] ?? [])
    return {
        maxHpBase: 1.2,
        atkBase: 1.1,
        rounds: exponents.map((n, i) => ({
            maxHpExponent: n,
            atkExponent: difficulty === 'ABYSS' ? abyssAtkExponents[i] : n,
            maxHpMultiplier: difficulty === 'ABYSS' && [5, 12, 13, 14].includes(i) ? 1.08 : 1,
            atkMultiplier: 1,
            moveSpeed: difficulty === 'ABYSS' && i >= 2 ? 1.15 : 1,
        })),
    }
}
function growthFactors(growth: EnemyGrowth): EnemyFactors[] {
    const rounded = (n: number) => Math.round(n * 1000) / 1000
    return growth.rounds.map((row) => ({
        maxHp: rounded(growth.maxHpBase ** row.maxHpExponent * row.maxHpMultiplier),
        atk: rounded(growth.atkBase ** row.atkExponent * row.atkMultiplier),
        moveSpeed: row.moveSpeed,
    }))
}
export function defaultDifficultyScaling(difficulty: string): ResolvedDifficultyScaling {
    const legacy = legacyDifficultyScaling(difficulty)
    if (difficulty !== 'ABYSS') return legacy
    const enemyGrowth = defaultEnemyGrowth(difficulty)
    return {
        ...legacy,
        enemyGrowth,
        enemyFactorsByRound: growthFactors(enemyGrowth),
        enemyFactorsRepeatLast: true,
    }
}
export function enemyFactorsAtRound(
    scaling: ResolvedDifficultyScaling,
    round: number,
): EnemyFactors {
    const rows = scaling.enemyFactorsByRound
    return (
        rows[round - 1] ??
        (round > rows.length && scaling.enemyFactorsRepeatLast ? rows.at(-1) : undefined) ?? {
            maxHp: 1,
            atk: 1,
            moveSpeed: 1,
        }
    )
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
    const scalingPath = path + '.difficultyScaling'
    const issues: { path: string; message: string }[] = []
    const invalid = (path: string, message: string) => issues.push({ path, message })
    const knownKeys = (value: Record<string, any>, keys: readonly string[], path: string) => {
        for (const key of Object.keys(value))
            if (!keys.includes(key)) invalid(path + '.' + key, '未知字段')
    }
    if (input !== undefined && !record(input)) invalid(scalingPath, '倍率配置必须是对象')
    const bossFields = [
        'bossHpMultiplier',
        'bossHpPerPlayer',
        'bossDebtBase',
        'bossDebtCap',
    ] as const
    knownKeys(scaling, [...bossFields, 'enemyGrowth', 'enemyFactorsByRound'], scalingPath)
    const candidate = { ...defaults }
    for (const field of bossFields) {
        if (scaling[field] === undefined) continue
        if (
            field === 'bossHpPerPlayer'
                ? typeof scaling[field] === 'boolean'
                : nonnegative(scaling[field])
        )
            (candidate as any)[field] = scaling[field]
        else invalid(scalingPath + '.' + field, '必须是有限非负数；人数开关必须是布尔值')
    }
    if (scaling.enemyGrowth !== undefined && scaling.enemyFactorsByRound !== undefined)
        invalid(scalingPath, '公式与最终倍率表不能同时声明')
    if (scaling.enemyGrowth !== undefined) {
        const growth = scaling.enemyGrowth
        const p = scalingPath + '.enemyGrowth'
        const before = issues.length
        if (!record(growth)) invalid(p, '公式必须是对象')
        else {
            knownKeys(growth, ['maxHpBase', 'atkBase', 'rounds'], p)
            for (const field of ['maxHpBase', 'atkBase'])
                if (!nonnegative(growth[field]) || growth[field] === 0)
                    invalid(p + '.' + field, '底数必须是正有限数')
            if (!Array.isArray(growth.rounds)) invalid(p + '.rounds', '回合表必须是数组')
            else
                for (let i = 0; i < growth.rounds.length; i++) {
                    const row = growth.rounds[i]
                    const rp = `${p}.rounds.${i}`
                    const fields = [
                        'maxHpExponent',
                        'atkExponent',
                        'maxHpMultiplier',
                        'atkMultiplier',
                        'moveSpeed',
                    ]
                    if (!record(row)) {
                        invalid(rp, '回合必须是对象')
                        continue
                    }
                    knownKeys(row, fields, rp)
                    for (const field of fields)
                        if (!nonnegative(row[field]))
                            invalid(rp + '.' + field, '必填，且必须是有限非负数')
                }
            if (issues.length === before) {
                const factors = growthFactors(growth as EnemyGrowth)
                factors.forEach((row, i) => {
                    for (const field of ['maxHp', 'atk'] as const)
                        if (!nonnegative(row[field]))
                            invalid(`${p}.rounds.${i}.${field}`, '公式计算或舍入溢出')
                })
                candidate.enemyGrowth = structuredClone(growth) as EnemyGrowth
                candidate.enemyFactorsByRound = factors
                candidate.enemyFactorsRepeatLast = true
            }
        }
    }
    if (scaling.enemyFactorsByRound !== undefined) {
        const p = scalingPath + '.enemyFactorsByRound'
        if (!Array.isArray(scaling.enemyFactorsByRound)) invalid(p, '逐回合倍率必须是数组')
        else {
            for (let i = 0; i < scaling.enemyFactorsByRound.length; i++) {
                const row = scaling.enemyFactorsByRound[i]
                const rp = `${p}.${i}`
                if (!record(row)) {
                    invalid(rp, '回合必须是对象')
                    continue
                }
                knownKeys(row, ['maxHp', 'atk', 'moveSpeed'], rp)
                for (const field of ['maxHp', 'atk', 'moveSpeed'])
                    if (
                        !(field === 'moveSpeed' && row[field] === undefined) &&
                        !nonnegative(row[field])
                    )
                        invalid(rp + '.' + field, '倍率必须是有限非负数')
            }
            delete candidate.enemyGrowth
            candidate.enemyFactorsByRound = structuredClone(scaling.enemyFactorsByRound)
            candidate.enemyFactorsRepeatLast = false
        }
    }
    // Publish a configuration and its sources only after validating the entire block.
    const result = issues.length ? defaults : candidate
    report(
        scalingPath,
        issues.length ? '本模式整套难度数值已回退服务器默认值' : '',
        'legacy-default',
    )
    for (const issue of issues)
        report(issue.path, issue.message + '；整套难度数值回退服务器默认值', 'legacy-default')
    for (const field of [...bossFields, 'enemyGrowth', 'enemyFactorsByRound'])
        report(
            scalingPath + '.' + field,
            '',
            !issues.length &&
                (scaling[field] !== undefined ||
                    (field === 'enemyFactorsByRound' && scaling.enemyGrowth !== undefined))
                ? 'season'
                : 'legacy-default',
        )
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
