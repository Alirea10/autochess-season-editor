import { parseBountyEffects } from './bounty-runtime'
/** Season resource contract v1. Mirrored in server/client; parity tested. */
export interface EnemyResource {
    level?: number
    isFlyEnemy?: boolean
    extraEnemyIdentifier?: number
    extraEnemyKeyList?: string[]
    enemyBattleEffectivenessFactor?: number
}
export interface ClientResources {
    preloadEnemies?: string[]
    enemyResources?: Record<string, EnemyResource>
    icons?: Record<string, { path: string; url?: string }>
    modeAliases?: Record<string, string>
    bossResources?: Record<string, { enemyId: string; handbookEnemyId?: string }>
}
export const enemyKey = (v: unknown): v is string =>
    typeof v === 'string' && /^enemy_[a-z0-9_]+$/i.test(v)
const record = (v: any): v is Record<string, any> =>
    v !== null && typeof v === 'object' && !Array.isArray(v)
export function resourceIssues(value: unknown): { path: string; message: string }[] {
    const issues: { path: string; message: string }[] = []
    const bad = (path: string, message: string) => {
        issues.push({ path: 'runtimeConfig.clientResources' + path, message })
    }
    if (value === undefined) return issues
    if (!record(value)) {
        bad('', '资源配置必须是对象')
        return issues
    }
    if (
        value.preloadEnemies !== undefined &&
        (!Array.isArray(value.preloadEnemies) || !value.preloadEnemies.every(enemyKey))
    )
        bad('.preloadEnemies', '预载列表必须只包含敌人 ID')
    for (const table of ['enemyResources', 'icons', 'modeAliases', 'bossResources']) {
        if (value[table] !== undefined && !record(value[table])) bad('.' + table, '必须是字典')
    }
    for (const [id, data] of Object.entries(
        record(value.enemyResources) ? value.enemyResources : {},
    )) {
        const path = '.enemyResources.' + id
        if (!enemyKey(id) || !record(data)) {
            bad(path, '敌人 ID 或资源对象无效')
            continue
        }
        for (const field of ['level', 'extraEnemyIdentifier', 'enemyBattleEffectivenessFactor']) {
            const n = data[field]
            if (
                n !== undefined &&
                (typeof n !== 'number' ||
                    !Number.isFinite(n) ||
                    n < 0 ||
                    (field !== 'enemyBattleEffectivenessFactor' && !Number.isInteger(n)))
            )
                bad(path + '.' + field, '必须是有限的非负数；等级和标识必须为整数')
        }
        if (data.isFlyEnemy !== undefined && typeof data.isFlyEnemy !== 'boolean')
            bad(path + '.isFlyEnemy', '必须是布尔值')
        if (
            data.extraEnemyKeyList !== undefined &&
            (!Array.isArray(data.extraEnemyKeyList) || !data.extraEnemyKeyList.every(enemyKey))
        )
            bad(path + '.extraEnemyKeyList', '依赖必须是敌人 ID 数组')
    }
    for (const [id, icon] of Object.entries(record(value.icons) ? value.icons : {})) {
        if (
            !id ||
            !record(icon) ||
            typeof icon.path !== 'string' ||
            !/^icon\/[a-zA-Z0-9_./-]+\.png$/.test(icon.path) ||
            icon.path.split('/').includes('..') ||
            (icon.url !== undefined &&
                (typeof icon.url !== 'string' || !/^https?:\/\//.test(icon.url)))
        )
            bad(
                '.icons.' + id,
                '图标必须声明 icon/ 下的 PNG 相对路径；下载地址可选且必须为 HTTP(S)',
            )
    }
    for (const [id, source] of Object.entries(record(value.modeAliases) ? value.modeAliases : {}))
        if (!id || typeof source !== 'string' || !source)
            bad('.modeAliases.' + id, '模式映射必须是非空 ID')
    for (const [id, data] of Object.entries(
        record(value.bossResources) ? value.bossResources : {},
    )) {
        if (
            !record(data) ||
            !enemyKey(data.enemyId) ||
            (data.handbookEnemyId !== undefined && !enemyKey(data.handbookEnemyId))
        )
            bad('.bossResources.' + id, 'Boss 资源必须声明合法 enemyId / handbookEnemyId')
    }
    return issues
}
/** Only positive references from supported producers are preload roots. */
export function collectEnemyRoots(season: any): Map<string, string[]> {
    const result = new Map<string, string[]>()
    const add = (value: unknown, path: string) => {
        for (const id of Array.isArray(value)
            ? value
            : typeof value === 'string'
              ? value.split(/[,|;\s]+/)
              : []) {
            if (enemyKey(id)) result.set(id, [...(result.get(id) ?? []), path])
        }
    }
    for (const [id, entry] of Object.entries(season.specialEnemyInfoDict ?? {}) as [
        string,
        any,
    ][]) {
        for (const field of [
            'specialEnemyKey',
            'attachedEliteEnemyKeys',
            'attachedNormalEnemyKeys',
        ])
            add(entry?.[field], `specialEnemyInfoDict.${id}.${field}`)
    }
    for (const [group, ids] of Object.entries(season.enemyInfoDict ?? {}))
        add(ids, `enemyInfoDict.${group}`)
    for (const bounty of Object.values(parseBountyEffects(season)))
        for (const spawn of bounty.spawns)
            add(spawn.enemyId, `effectBuffInfoDataDict.${spawn.effectId}.${spawn.entryIndex}`)
    const producerFields: Record<string, string[]> = {
        add_enemy_kill_gain_coin: ['enemy_id'],
        add_enemy_win_gain_coin: ['enemy_id'],
        add_enemy_selfbattle_win_gain_coin: ['enemy_id'],
        next_battle_add_enemy_win_gain_coin: ['enemy_id'],
        round_start_all_player_change_enemy_2: ['enemylist'],
    }
    for (const [effect, entries] of Object.entries(season.effectBuffInfoDataDict ?? {}) as [
        string,
        any,
    ][]) {
        if (
            !Array.isArray(entries) ||
            season.effectInfoDataDict?.[effect]?.effectType === 'ENEMY_GAIN'
        )
            continue
        entries.forEach((entry, index) => {
            for (const bb of entry.blackboard ?? [])
                if (producerFields[entry.key]?.includes(bb.key))
                    add(
                        bb.valueStr,
                        `effectBuffInfoDataDict.${effect}.${index}.blackboard.${bb.key}`,
                    )
        })
    }
    const resources: ClientResources = season.runtimeConfig?.clientResources ?? {}
    for (const [id, boss] of Object.entries(resources.bossResources ?? {}))
        add(boss.enemyId, 'runtimeConfig.clientResources.bossResources.' + id)
    add(resources.preloadEnemies, 'runtimeConfig.clientResources.preloadEnemies')
    for (const id of Object.keys(resources.enemyResources ?? {}))
        add(id, 'runtimeConfig.clientResources.enemyResources.' + id)
    return result
}
export interface PlannedEnemy extends Required<Omit<EnemyResource, 'extraEnemyKeyList'>> {
    enemyKey: string
    extraEnemyKeyList: string[] | null
}
export function planEnemies(season: any, native: (id: string) => any): Map<string, PlannedEnemy> {
    const issues = resourceIssues(season.runtimeConfig?.clientResources)
    if (issues.length) throw new Error(issues.map((i) => `${i.path}: ${i.message}`).join('; '))
    const roots = collectEnemyRoots(season)
    const plan = new Map<string, PlannedEnemy>()
    const declarations = season.runtimeConfig?.clientResources?.enemyResources ?? {}
    const fly = new Set(season.enemyInfoDict?.FLY ?? [])
    const visit = (id: string) => {
        if (plan.has(id)) return
        if (plan.size >= 4096) throw new Error('敌人依赖超过 4096 个，停止安装')
        const original = native(id)
        const entry = {
            enemyKey: id,
            level: 0,
            extraEnemyIdentifier: 0,
            extraEnemyKeyList: null,
            isFlyEnemy: fly.has(id),
            enemyBattleEffectivenessFactor: 1,
            ...original,
            ...declarations[id],
        }
        plan.set(id, entry)
        for (const dependency of entry.extraEnemyKeyList ?? []) {
            if (!enemyKey(dependency))
                throw new Error(`enemyResources.${id}.extraEnemyKeyList: 无效依赖`)
            visit(dependency)
        }
    }
    for (const id of [...roots.keys()].sort()) visit(id)
    return plan
}
