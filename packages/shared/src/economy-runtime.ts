/** Shared economy contract and legacy defaults; arrays use one-based game levels/rounds. */
export interface ShopRuntimeConfig {
    charRates?: number[][]
    equipRates?: number[][]
    charStockByLevel?: Record<string, number>
    equipStockByLevel?: Record<string, number>
}
export interface EconomyRuntimeConfig {
    incomeByDifficulty?: Record<string, number[]>
    freeRefreshByDifficulty?: Record<string, number[]>
}
export const legacyShop: Required<ShopRuntimeConfig> = {
    charRates: [
        [1, 0, 0, 0, 0, 0],
        [0.5, 0.5, 0, 0, 0, 0],
        [0.3, 0.35, 0.35, 0, 0, 0],
        [0.25, 0.25, 0.25, 0.25, 0, 0],
        [0.1, 0.2, 0.25, 0.3, 0.15, 0],
        [0.02, 0.18, 0.3, 0.3, 0.13, 0.07],
    ],
    equipRates: [
        [1, 0, 0, 0, 0, 0],
        [0.6, 0.4, 0, 0, 0, 0],
        [0.4, 0.35, 0.25, 0, 0, 0],
        [0.25, 0.3, 0.25, 0.2, 0, 0],
        [0.2, 0.3, 0.2, 0.2, 0.1, 0],
        [0.2, 0.2, 0.2, 0.2, 0.1, 0.1],
    ],
    charStockByLevel: { 1: 12, 2: 14, 3: 18, 4: 16, 5: 8, 6: 5 },
    equipStockByLevel: { 1: 4, 2: 6, 3: 7, 4: 8, 5: 7, 6: 3 },
}
const normal = [4, 5, 6, 7, 8, 9, 10, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11]
const hard = [4, 5, 6, 7, 8, 8, 9, 10, 11, 11, 11, 11, 11, 11, 11, 11, 11]
export const legacyEconomy: Required<EconomyRuntimeConfig> = {
    incomeByDifficulty: {
        TRAINING: normal,
        FUNNY: normal,
        NORMAL: normal,
        HARD: hard,
        ABYSS: hard,
    },
    freeRefreshByDifficulty: { TRAINING: [0], FUNNY: [0, 2], NORMAL: [0], HARD: [0], ABYSS: [0] },
}
export type EconomyRuntime = {
    shop: Required<ShopRuntimeConfig>
    economy: Required<EconomyRuntimeConfig>
}
const record = (v: any): v is Record<string, any> =>
    v !== null && typeof v === 'object' && !Array.isArray(v)
const number = (v: any) => typeof v === 'number' && Number.isFinite(v) && v >= 0
export function resolveEconomyRuntime(
    runtime: any,
    report: (
        path: string,
        message: string,
        source: 'season' | 'legacy-default' | 'disabled',
    ) => void = () => {},
): EconomyRuntime {
    const output: any = structuredClone({ shop: legacyShop, economy: legacyEconomy })
    for (const section of ['shop', 'economy']) {
        const input = runtime?.[section]
        if (input === undefined) {
            report(`runtimeConfig.${section}`, '', 'legacy-default')
            continue
        }
        if (!record(input)) {
            report(`runtimeConfig.${section}`, '配置不是对象，采用旧默认值', 'legacy-default')
            continue
        }
        for (const key of Object.keys(output[section])) {
            const value = input[key],
                path = `runtimeConfig.${section}.${key}`
            if (value === undefined) {
                report(path, '', 'legacy-default')
                continue
            }
            const defaults = output[section][key]
            if (key.endsWith('Rates')) {
                if (!Array.isArray(value)) {
                    report(path, '概率表必须是二维数组，采用旧表', 'legacy-default')
                    continue
                }
                report(path, '', 'season')
                output[section][key] = value.map((row, i) => {
                    if (
                        Array.isArray(row) &&
                        row.every(number) &&
                        Number.isFinite(row.reduce((a, b) => a + b, 0))
                    )
                        return row
                    report(
                        `${path}.${i}`,
                        '概率行无效，采用同级旧值；新等级停用',
                        defaults[i] ? 'legacy-default' : 'disabled',
                    )
                    return defaults[i] ?? []
                })
            } else if (record(value)) {
                report(path, '', 'season')
                // An explicit empty dictionary disables all entries; otherwise missing known entries retain defaults.
                output[section][key] = Object.keys(value).length ? { ...defaults } : {}
                for (const [id, entry] of Object.entries(value)) {
                    const valid =
                        section === 'shop'
                            ? /^[1-9]\d*$/.test(id) && number(entry) && Number.isSafeInteger(entry)
                            : Array.isArray(entry) &&
                              entry.every((n) => number(n) && Number.isSafeInteger(n))
                    if (valid) output[section][key][id] = entry
                    else {
                        report(
                            `${path}.${id}`,
                            '条目无效，采用同项旧值；无旧值停用',
                            defaults[id] !== undefined ? 'legacy-default' : 'disabled',
                        )
                        output[section][key][id] = defaults[id] ?? (section === 'shop' ? 0 : [])
                    }
                }
            } else report(path, '配置必须是字典，采用旧值', 'legacy-default')
        }
    }
    return output
}
export function roundValue(curve: number[] | undefined, round: number): number {
    return curve?.[round - 1] ?? curve?.[curve.length - 1] ?? 0
}
/** Current protocol/UI envelope: negative bench slots, 15x15 coordinates, six native shop slots. */
export const capacityLimits = {
    maxDeckChessCnt: 19,
    maxBattleChessCnt: 225,
    storeCntMax: 6,
} as const
export function capacityIssues(constants: any): { path: string; message: string }[] {
    return Object.entries(capacityLimits).flatMap(([key, max]) => {
        const n = constants?.[key]
        return Number.isSafeInteger(n) && n >= 0 && n <= max
            ? []
            : [
                  {
                      path: `constData.${key}`,
                      message: `当前客户端支持范围为 0～${max}；请调整赛季容量`,
                  },
              ]
    })
}
