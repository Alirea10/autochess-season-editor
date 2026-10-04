import type { AutoChessSeasonData, BondBanRule, BondClassification, ResolvedBanConfig } from './season-data'
const LEGACY_CORE_BOND_IDS = ['yanShip', 'sargonShip', 'victoriaShip', 'kjeragShip', 'lateranoShip', 'egirShip', 'kazimierzShip', 'siracusaShip']
function legacyBanDefaults(data: Record<string, unknown>) {
    return Object.hasOwn((data.bondInfoDict ?? {}) as object, 'kazimierzShip')
        ? { immuneBonds: ['suntShip', 'emptyShip', 'maniShip', 'investShip'], coreBondBanCount: 3, minorBondBanCount: 4 }
        : { immuneBonds: ['deputShip', 'emptyShip', 'visiShip'], coreBondBanCount: 2, minorBondBanCount: 2 }
}

const isObject = (v: unknown): v is Record<string, any> =>
    !!v && typeof v === 'object' && !Array.isArray(v)
const ids = (v: unknown): v is string[] =>
    Array.isArray(v) && v.every(id => typeof id === 'string')
const count = (v: unknown): v is number =>
    typeof v === 'number' && Number.isSafeInteger(v) && v >= 0

export const BOND_BAN_RULES = ['all', 'normal', 'release', 'ignore', 'immune'] as const

/** Independent of classification: an invalid extension must never contaminate this fallback. */
export function resolveLegacyBanConfig(data: Pick<AutoChessSeasonData, 'banConfig' | 'bondInfoDict'>): ResolvedBanConfig {
    const raw = isObject(data.banConfig) ? data.banConfig : {}
    const defaults = legacyBanDefaults(data as unknown as Record<string, unknown>)
    const known = (values: string[]) => [...new Set(values)].filter(id => Object.hasOwn(data.bondInfoDict, id))
    const coreBondIds = known(ids(raw.coreBondIds) ? raw.coreBondIds : [...LEGACY_CORE_BOND_IDS])
    const immuneBonds = known(ids(raw.immuneBonds) ? raw.immuneBonds : defaults.immuneBonds)
    return {
        mode: 'normal',
        coreBondIds,
        immuneBonds,
        minorBondIds: known(ids(raw.minorBondIds) ? raw.minorBondIds :
            Object.keys(data.bondInfoDict).sort().filter(id => !coreBondIds.includes(id) && !immuneBonds.includes(id))),
        coreBondBanCount: count(raw.coreBondBanCount) ? raw.coreBondBanCount : defaults.coreBondBanCount,
        minorBondBanCount: count(raw.minorBondBanCount) ? raw.minorBondBanCount : defaults.minorBondBanCount,
    }
}

/** Validate the whole extension before accepting any of its behavior. */
export function parseBondClassification(value: unknown, bonds: Record<string, unknown>): BondClassification {
    if (!isObject(value) || value.version !== 1 || !isObject(value.classes) || !isObject(value.bondRules))
        throw new Error('盟约分类必须包含 version: 1、classes 和 bondRules')
    for (const required of ['core', 'minor'])
        if (!Object.hasOwn(value.classes, required)) throw new Error('缺少默认盟约类：' + required)
    for (const [id, category] of Object.entries(value.classes)) {
        if (!id.trim() || !isObject(category) || typeof category.name !== 'string' || !category.name.trim() ||
            !ids(category.bondIds) || !count(category.drawCount))
            throw new Error('盟约类配置无效：' + id)
        for (const bondId of category.bondIds)
            if (!Object.hasOwn(bonds, bondId)) throw new Error('盟约类引用不存在的盟约：' + bondId)
    }
    for (const [id, rule] of Object.entries(value.bondRules)) {
        if (!Object.hasOwn(bonds, id)) throw new Error('规则引用不存在的盟约：' + id)
        if (!BOND_BAN_RULES.includes(rule as BondBanRule)) throw new Error('盟约规则无效：' + id)
    }
    return structuredClone(value) as BondClassification
}

export function inspectBondClassification(data: Pick<AutoChessSeasonData, 'banConfig' | 'bondInfoDict'>):
    { classification?: BondClassification; warning?: string } {
    const value = data.banConfig?.classification
    if (value === undefined) return {}
    try { return { classification: parseBondClassification(value, data.bondInfoDict) } }
    catch (error) { return { warning: error instanceof Error ? error.message : String(error) } }
}

export function enableBondClassification(data: AutoChessSeasonData): AutoChessSeasonData {
    const legacy = resolveLegacyBanConfig(data)
    const all = data.banConfig?.mode === 'banCore'
    const classification: BondClassification = {
        version: 1,
        classes: {
            core: { name: '核心盟约', bondIds: legacy.coreBondIds, drawCount: legacy.coreBondBanCount },
            minor: { name: '小盟约', bondIds: legacy.minorBondIds.filter(id => !legacy.coreBondIds.includes(id)), drawCount: legacy.minorBondBanCount },
        },
        bondRules: Object.fromEntries(Object.keys(data.bondInfoDict).map(id =>
            [id, all ? (legacy.immuneBonds.includes(id) ? 'ignore' : 'all') : 'normal'])),
    }
    return withBondClassification(data, classification)
}

/** Only valid editor changes mirror legacy fields; malformed imported JSON is preserved. */
export function withBondClassification(data: AutoChessSeasonData, classification: BondClassification): AutoChessSeasonData {
    return { ...data, banConfig: {
        ...data.banConfig, classification,
        coreBondIds: [...classification.classes.core.bondIds],
        minorBondIds: [...classification.classes.minor.bondIds],
        coreBondBanCount: classification.classes.core.drawCount,
        minorBondBanCount: classification.classes.minor.drawCount,
    } }
}

/** Classification metadata should not prevent deletion of the covenant itself. */
export function removeBondClassificationReferences(data: AutoChessSeasonData, bondId: string): AutoChessSeasonData {
    const { classification } = inspectBondClassification(data)
    if (!classification) return data
    for (const category of Object.values(classification.classes))
        category.bondIds = category.bondIds.filter(id => id !== bondId)
    delete classification.bondRules[bondId]
    return withBondClassification(data, classification)
}

export function classifiedBanReasons(
    charBondIds: readonly string[], selected: ReadonlySet<string>, classification?: BondClassification,
): string[] {
    const memberships = [...new Set(charBondIds)]
    if (!memberships.length) return []
    if (!classification) return memberships.every(id => selected.has(id)) ? memberships : []
    const rule = (id: string): BondBanRule => classification.bondRules[id] ?? 'normal'
    if (memberships.some(id => rule(id) === 'immune' || (rule(id) === 'release' && selected.has(id)))) return []
    const all = memberships.filter(id => rule(id) === 'all' && selected.has(id))
    const normal = memberships.filter(id => rule(id) === 'normal')
    return [...new Set([...all, ...(normal.length && normal.every(id => selected.has(id)) ? normal : [])])]
}
