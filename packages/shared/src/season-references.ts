/** Find exact references, including ID lists in effect string parameters. */
export function findSeasonReferences(data: unknown, id: string, excludedPaths: string[] = []): string[] {
    const result: string[] = []
    const visit = (value: any, path: string) => {
        if (excludedPaths.some(prefix => path === prefix || path.startsWith(prefix + '.'))) return
        if (typeof value === 'string') {
            if (value === id || (path.endsWith('.valueStr') && value.split(/[,|;\s]+/).includes(id))) result.push(path)
        } else if (value && typeof value === 'object') {
            for (const [key, child] of Object.entries(value)) {
                const next = path ? `${path}.${key}` : key
                if (key === id && !excludedPaths.includes(next)) result.push(next)
                visit(child, next)
            }
        }
    }
    visit(data, '')
    return [...new Set(result)]
}

export function missingSeasonReferences(data: any): { path: string; id: string }[] {
    const result: {path:string;id:string}[] = []
    const targets: Record<string, string> = { bondId:'bondInfoDict',bondIds:'bondInfoDict',activeBondIdList:'bondInfoDict',inactiveBondIdList:'bondInfoDict',coreBondIds:'bondInfoDict',minorBondIds:'bondInfoDict',immuneBonds:'bondInfoDict',giveBondId:'bondInfoDict',bossId:'bossInfoDict',modeId:'modeDataDict',preposedMode:'modeDataDict',effectId:'effectInfoDataDict',upgradeChessId:'chess',chessIdList:'chess' }
    const exists = (table:string,id:string) => table==='chess' ? !!(data.charChessDataDict?.[id] || data.trapChessDataDict?.[id]) : !!data[table]?.[id]
    const visit = (value:any,path:string,key:string) => {
        const table = targets[key]
        if (table) for (const id of Array.isArray(value)?value:[value]) if (typeof id==='string' && id && !exists(table,id)) result.push({path,id})
        if (value && typeof value==='object') for (const [child,v] of Object.entries(value)) visit(v,path?`${path}.${child}`:child,child)
    }
    visit(data,'','')
    return result
}
