import { normalizeSeasonDataForRuntime, type AutoChessSeasonData } from '@autochess-editor/shared'

export type ChessVersionScope = 'both' | 'normal' | 'golden'
export interface ChessPair {
  id: string
  normalId?: string
  goldenId?: string
  ids: string[]
  conflict: boolean
}

/** Use declared relationships, including nonstandard IDs. Ambiguous components stay separate. */
export function buildChessPairs(data: AutoChessSeasonData): Map<string, ChessPair> {
  const graph = new Map<string, Set<string>>()
  const normals = new Set<string>(), goldens = new Set<string>()
  const node = (id: string) => { if (!graph.has(id)) graph.set(id, new Set()) }
  const link = (normal: string, golden?: string | null) => {
    node(normal); normals.add(normal)
    if (!golden || normal === golden) return
    node(golden); goldens.add(golden)
    graph.get(normal)!.add(golden); graph.get(golden)!.add(normal)
  }
  for (const [id, chess] of Object.entries(data.charChessDataDict)) {
    node(id)
    ;(chess.isGolden ? goldens : normals).add(id)
    if (chess.upgradeChessId) link(id, chess.upgradeChessId)
  }
  for (const [id, shop] of Object.entries(data.charShopChessDatas)) link(id, shop.goldenChessId)
  for (const [id, normal] of Object.entries(data.chessNormalIdLookupDict)) {
    if (id !== normal) link(normal, id)
  }
  const result = new Map<string, ChessPair>(), visited = new Set<string>()
  for (const root of graph.keys()) {
    if (visited.has(root)) continue
    const queue = [root], component: string[] = []
    while (queue.length) {
      const id = queue.pop()!
      if (visited.has(id)) continue
      visited.add(id); component.push(id)
      queue.push(...graph.get(id)!)
    }
    const normal = component.filter(id => normals.has(id)), golden = component.filter(id => goldens.has(id))
    const conflict = normal.length > 1 || golden.length > 1 || normal.some(id => goldens.has(id))
    const existing = component.filter(id => !!data.charChessDataDict[id])
    if (conflict) {
      for (const id of component) result.set(id, {
        id, ids: existing.includes(id) ? [id] : [], conflict: true,
        ...(data.charChessDataDict[id]?.isGolden ? { goldenId: id } : { normalId: id }),
      })
    } else {
      const pair: ChessPair = { id: normal[0] ?? golden[0] ?? root, normalId: normal[0], goldenId: golden[0], ids: existing, conflict: false }
      for (const id of component) result.set(id, pair)
    }
  }
  return result
}

export interface MembershipChange { chessId: string; scope: ChessVersionScope; present: boolean }
export function changeBondMembership(data: AutoChessSeasonData, bondId: string, changes: MembershipChange[]): AutoChessSeasonData {
  const bond = data.bondInfoDict[bondId]
  if (!bond) throw new Error('盟约已不存在，请重新选择')
  const pairs = buildChessPairs(data)
  const members = new Set(bond.chessIdList)
  for (const change of changes) {
    const pair = pairs.get(change.chessId)
    if (!pair) {
      if (!change.present) { members.delete(change.chessId); continue }
      throw new Error(`棋子已不存在：${change.chessId}`)
    }
    if (change.scope === 'both' && pair.conflict) throw new Error(`棋子关联冲突，须单独操作：${change.chessId}`)
    const declaredIds = [pair.normalId, pair.goldenId].filter((id): id is string => !!id)
    const targets = (change.scope === 'both' ? declaredIds : [change.scope === 'normal' ? pair.normalId : pair.goldenId])
      .filter((id): id is string => !!id && (!change.present || pair.ids.includes(id)))
    if (!targets.length && change.present) throw new Error('所选版本不存在')
    for (const id of targets) {
      if (change.present) members.add(id)
      else members.delete(id)
    }
  }
  return normalizeSeasonDataForRuntime({ ...data, bondInfoDict: {
    ...data.bondInfoDict, [bondId]: { ...bond, chessIdList: [...members] },
  } })
}
