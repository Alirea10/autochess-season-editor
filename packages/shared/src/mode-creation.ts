import type { AutoChessSeasonData } from './season-data'

/** Copy all mode-owned tables together; never leave a selectable but unplayable shell. */
export function duplicateSeasonMode(
    data: AutoChessSeasonData,
    sourceId: string,
    modeId: string,
    name?: string,
): AutoChessSeasonData {
    if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(modeId))
        throw new Error('模式 ID 需以字母开头，仅使用字母、数字和下划线')
    if (Object.hasOwn(data.modeDataDict, modeId)) throw new Error(`模式 ${modeId} 已存在`)
    const source = data.modeDataDict[sourceId]
    if (!source) throw new Error('请选择有效的复制来源')
    if (
        !['TRAINING', 'FUNNY', 'NORMAL', 'HARD', 'ABYSS'].includes(source.modeDifficulty) ||
        !['LOCAL', 'SINGLE', 'MULTI'].includes(source.modeType)
    )
        throw new Error('来源需要使用已支持的基础难度和模式类型')
    if (
        !Object.keys(data.shopLevelDataDict[sourceId] ?? {}).length ||
        !Object.keys(data.battleDataDict[sourceId] ?? {}).length
    )
        throw new Error('来源缺少商店或战斗回合表')
    if (
        !Object.values(data.stageDatasDict).some(
            (stage) => stage.weight > 0 && stage.mode.includes(sourceId),
        )
    )
        throw new Error('来源没有允许的正权重地图')
    const resources = data.runtimeConfig?.clientResources
    const aliases = resources?.modeAliases ?? {}
    const seen = new Set<string>()
    let nativeId = sourceId
    while (aliases[nativeId] && aliases[nativeId] !== nativeId) {
        if (seen.has(nativeId)) throw new Error('来源模式的原生资源映射存在循环')
        seen.add(nativeId)
        nativeId = aliases[nativeId]
    }
    // Match the client's native inference for a custom source with no explicit alias.
    if (nativeId === sourceId && !Object.hasOwn(aliases, sourceId))
        nativeId =
            source.modeType === 'LOCAL'
                ? 'mode_training_1'
                : `mode_${source.modeType.toLowerCase()}_${source.modeDifficulty.toLowerCase()}`
    const copied = structuredClone(source)
    return {
        ...data,
        modeDataDict: {
            ...data.modeDataDict,
            [modeId]: {
                ...copied,
                modeId,
                name: name?.trim() || `${source.name} 副本`,
                sortId:
                    Math.max(-1, ...Object.values(data.modeDataDict).map((mode) => mode.sortId)) +
                    1,
            },
        },
        shopLevelDataDict: {
            ...data.shopLevelDataDict,
            [modeId]: structuredClone(data.shopLevelDataDict[sourceId]),
        },
        battleDataDict: {
            ...data.battleDataDict,
            [modeId]: structuredClone(data.battleDataDict[sourceId]),
        },
        stageDatasDict: Object.fromEntries(
            Object.entries(data.stageDatasDict).map(([key, stage]) => [
                key,
                stage.mode.includes(sourceId) ? { ...stage, mode: [...stage.mode, modeId] } : stage,
            ]),
        ),
        runtimeConfig: {
            ...data.runtimeConfig,
            version: 1,
            clientResources: { ...resources, modeAliases: { ...aliases, [modeId]: nativeId } },
        },
    }
}
