/** Pure data analysis shared by the browser and the offline GameData indexer. */
export interface BlackboardValue {
  key: string
  value: number | null
  valueStr: string | null
}

export type BlackboardScope = 'buff' | 'otherBuff' | 'ability' | 'global'
export interface BlackboardReference {
  key: string
  scope: BlackboardScope
  access: 'read' | 'write'
  target?: string
  node: string
  path: string
  detail: string
}

export interface BlackboardSource {
  id: string
  kind: string
  label: string
  conditions: string[]
  file: string
  path: string
  values: BlackboardValue[]
  navigation?: { module: 'effects' | 'garrison'; id: string }
}

export interface BlackboardBinding {
  sourceId: string
  confidence: 'explicit' | 'candidate'
  evidence: string
  /** Original source key -> key in this Buff. No destructive prefix removal. */
  keys: Record<string, string>
}

export interface BlackboardShard {
  sources: Record<string, BlackboardSource>
  templates: Record<string, BlackboardBinding[]>
}

export interface BlackboardManifest {
  schemaVersion: 1
  revision: string
  dataVersion: string
  coverage: { files: number; levels: number; sources: number; linkedSources: number; templates: number }
  templates: Record<string, string>
}

type ObjectData = Record<string, any>
export type Templates = Record<string, ObjectData>

export function walkObjects(value: unknown, visit: (value: ObjectData, path: string) => void, path = '$', seen = new Set<object>()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return
  seen.add(value)
  if (Array.isArray(value)) value.forEach((v, i) => walkObjects(v, visit, `${path}[${i}]`, seen))
  else {
    visit(value as ObjectData, path)
    for (const [key, child] of Object.entries(value)) walkObjects(child, visit, `${path}.${key}`, seen)
  }
}

export function readBlackboard(value: unknown): BlackboardValue[] {
  if (!Array.isArray(value)) return []
  return value.filter(v => v && typeof v.key === 'string' && ('value' in v || 'valueStr' in v)).map(v => ({
    key: v.key,
    value: typeof v.value === 'number' ? v.value : null,
    valueStr: typeof v.valueStr === 'string' ? v.valueStr : null,
  }))
}

// These are parameter fields, not arbitrary identifiers ending in "Key".
const READ_FIELDS = new Set([
  '_inputKey', '_valueKey', '_multiplyParamKey', '_dividedParamKey', '_addParamKey', '_minusParamKey',
  '_minValueKey', '_maxValueKey', '_anotherKeyToCompare', '_multiplierKey', '_damageKey', '_additionValueKey',
  '_atkScaleVar', '_atkScaleKey', '_var', '_spString', '_countKey', '_cntKey', '_stackCountKey', '_maxTargetKey',
  '_durationKey', '_radiusKey', '_probabilityKey', '_probKey', '_intervalKey', '_healScaleKey', '_scaleKey',
  '_speedKey', '_delayKey', '_rangeRadiusKey', '_maxStackCntKey', '_lifeTimeKey',
  '_copyFromKey', '_additionKey', '_extraDurationKey', '_scaleVar', '_compareBBKey', '_limitValueKey',
  '_cachedAtkKey', '_loadCurModeBbKey',
])
const WRITE_FIELDS = new Set(['_outputKey', '_cachedDeltaValueToBBKey'])
const WRITE_TYPES = /Setter|Assign.*(?:To|Into).*?(?:Blackboard|BB)|Cache.*(?:Blackboard|BB)|Set.*Blackboard|ModifyBlackboard|CalculateBlackboard|BlackboardAdd|Fetch.*Blackboard/

/** Declared reads/writes only; never executes game logic or supplies implicit zeroes. */
export function collectBlackboardReferences(tree: unknown): BlackboardReference[] {
  const result: BlackboardReference[] = []
  walkObjects(tree, (node, path) => {
    if (typeof node.$type !== 'string') return
    const type = node.$type.replace(/,.*$/, '').split(/[.+]/).pop()!
    const ability = node._useAbilityBlackboard || node.fromAbilityBlackBoard || node._useOtherAbility
    const add = (field: string, access: 'read' | 'write', scope: BlackboardScope = ability ? 'ability' : 'buff', target?: string) => {
      const v = node[field]
      if (typeof v !== 'string' || !v.trim()) return
      for (const key of v.split(/[;,]/).map((s: string) => s.trim()).filter(Boolean)) {
        result.push({ key, access, scope, target: target || (scope === 'ability' ? node._abilityName : undefined), node: type, path: `${path}.${field}`,
          detail: `${access === 'write' ? '运行时写入' : '读取'} · ${type}${node._targetType ? ` · ${node._targetType}` : ''}${access === 'write' && typeof node._value === 'number' ? ` · 配置 _value=${node._value}` : ''}` })
      }
    }
    for (const field of READ_FIELDS) add(field, 'read')
    for (const field of WRITE_FIELDS) add(field, 'write')
    if (type === 'AssignBuffCountIntoBlackboard' || type === 'AssignBuffExistingTimeIntoBlackboard') {
      const field = type === 'AssignBuffCountIntoBlackboard' ? '_stackCountKey' : '_extraDurationKey'
      for (let i = result.length - 1; i >= 0; i--) if (result[i].path === `${path}.${field}`) result.splice(i, 1)
      add(field, 'write')
    }
    if (type === 'AssignBuffBlackboard') {
      add('_blackboardKey', 'write', 'otherBuff', node._buffKey)
      add('_buffKeyAssignFrom', 'read')
    } else if (type === 'AssignBuffBlackboardFromOthers') {
      // Example: damage_scale[decay] copies damage_resistance from the other
      // Buff into its local "origin", later used in CalculateBlackboardValueViaParams.
      for (let i = result.length - 1; i >= 0; i--) if (result[i].path === `${path}._valueKey`) result.splice(i, 1)
      add('_blackboardKey', 'write', 'buff')
      add('_valueKey', 'read', 'otherBuff', node._buffKey)
    } else if (/GlobalBlackboard/.test(type) && !/ToBlackboard/.test(type)) {
      add('_blackboardKey', /^(Add|Set|Modify|Assign|Remove)/.test(type) ? 'write' : 'read', 'global', node._channel)
      add('_valueBlackboardKey', 'read', 'buff')
    } else if (/GlobalBlackboard/.test(type)) {
      add('_globalblackboardKey', /ToGlobal/.test(type) ? 'write' : 'read', 'global')
      add('_globalBlackboardKey', /ToGlobal/.test(type) ? 'write' : 'read', 'global')
      add('_blackboardKey', /ToGlobal/.test(type) ? 'read' : 'write', 'buff')
    } else if (type === 'ModifyAbilityBlackboard') {
      add('_blackboardKeys', 'write', 'ability', node._abilityName)
      add('_fromBlackboardKeys', 'read', node._fromBuffBlackboard ? 'otherBuff' : node.fromAbilityBlackBoard ? 'ability' : 'buff', node._fromBuffBlackboard ? node._buffKey : node._abilityName)
    } else if (/^(Add|Modify)AbilityBlackboard/.test(type)) {
      add('_blackboardKeys', 'write', 'ability', node._abilityName ?? node._ability)
      add('_addBlackboardKey', 'read', node._fromOwnerBlackBoard ? 'buff' : 'ability')
    } else if (type === 'AddBuffBlackboard') {
      add('_blackboardKey', 'write', 'otherBuff', node._buffKey)
    } else {
      add('_blackboardKey', WRITE_TYPES.test(type) ? 'write' : 'read', node._anotherBuff || node._useBuffBlackboard ? 'otherBuff' : ability ? 'ability' : 'buff', node._buffKey)
      add('_blackBoardKey', WRITE_TYPES.test(type) ? 'write' : 'read')
      add('_bbKey', WRITE_TYPES.test(type) ? 'write' : 'read')
      add('_blackboardKeys', WRITE_TYPES.test(type) ? 'write' : 'read')
      if (type === 'ModifyBlackboard') add('_fromBlackboardKeys', 'read')
      if (/Setter/.test(type)) add('_targetKey', 'write')
      if (/Blackboard|BB/.test(type)) add('_key', WRITE_TYPES.test(type) ? 'write' : 'read')
    }
  })
  return [...new Map(result.map(r => [`${r.path}:${r.key}:${r.scope}:${r.access}`, r])).values()]
}

export interface SourceTarget {
  key: string
  confidence: 'explicit' | 'candidate'
  evidence: string
  /** Candidate prefix aliases require matching a declared key in the target. */
  matchKeys?: boolean
}

export function createBlackboardIndex(templates: Templates) {
  const sources: Record<string, BlackboardSource> = {}
  const bindings: Record<string, BlackboardBinding[]> = {}
  const keys = Object.keys(templates)
  const keySet = new Set(keys)
  const refs = new Map<string, Set<string>>()
  const references = (key: string) => {
    if (!refs.has(key)) refs.set(key, new Set(collectBlackboardReferences(templates[key]).filter(r => r.scope === 'buff').map(r => r.key)))
    return refs.get(key)!
  }
  const familyCache = new Map<string, string[]>()
  function family(prefix: string) {
    if (!prefix) return []
    let found = familyCache.get(prefix)
    if (!found) {
      found = keys.filter(k => k === prefix || (k.startsWith(prefix) && /^[\[._@]/.test(k.slice(prefix.length))))
      familyCache.set(prefix, found)
    }
    return found
  }
  function add(source: BlackboardSource, targets: SourceTarget[] = []) {
    if (!source.values.length) return
    sources[source.id] = source
    const candidates = new Map<string, { target: SourceTarget; mappings: Record<string, string> }>()
    for (const target of targets) {
      if (!keySet.has(target.key)) continue
      const mappings: Record<string, string> = {}
      for (const row of source.values) {
        // Qualified keys are not silently applied to other Buffs/abilities.
        const prefix = `${target.key}.`
        if (row.key.startsWith(prefix)) mappings[row.key] = row.key.slice(prefix.length)
        else if (!target.matchKeys) mappings[row.key] = row.key
        else if (references(target.key).has(row.key)) mappings[row.key] = row.key
        else {
          const tail = row.key.split(/[.@]/).pop()!
          if (references(target.key).has(tail)) mappings[row.key] = tail
        }
      }
      if (Object.keys(mappings).length) candidates.set(target.key, { target, mappings })
    }
    // Exact template-qualified names are stronger evidence than naming conventions.
    for (const row of source.values) {
      for (let i = row.key.lastIndexOf('.'); i > 0; i = row.key.lastIndexOf('.', i - 1)) {
        const key = row.key.slice(0, i)
        if (!keySet.has(key)) continue
        const existing = candidates.get(key)
        const mappings = existing?.target.confidence === 'explicit' ? existing.mappings : {}
        mappings[row.key] = row.key.slice(i + 1)
        candidates.set(key, { target: { key, confidence: 'explicit', evidence: `黑板键明确指定模板前缀 ${key}` }, mappings })
        break
      }
    }
    for (const [key, { target, mappings }] of candidates) {
      const list = bindings[key] ?? (bindings[key] = [])
      const binding = { sourceId: source.id, confidence: target.confidence, evidence: target.evidence, keys: mappings }
      const old = list.findIndex(b => b.sourceId === source.id)
      if (old >= 0) list[old] = binding
      else list.push(binding)
    }
  }
  return { sources, bindings, family, add }
}

/** Only recognized Buff dispatchers turn blackboard.key into a template reference. */
export function explicitTargets(object: ObjectData, values: BlackboardValue[]): SourceTarget[] {
  const out: SourceTarget[] = []
  for (const field of ['templateKey', '_templateKey', 'buff']) {
    if (typeof object[field] === 'string' && object[field]) out.push({ key: object[field], confidence: 'explicit', evidence: `${field} = ${object[field]}` })
  }
  const dispatch = object.key ?? object.battleRuneKey
  if (typeof dispatch === 'string' && /^env_gbuff/.test(dispatch)) {
    const key = values.find(v => v.key === 'key')?.valueStr
    if (key) out.push({ key, confidence: 'explicit', evidence: `${dispatch} → blackboard.key = ${key}` })
  }
  return out
}

export function addInlineSources(index: ReturnType<typeof createBlackboardIndex>, templates: Templates, file: string) {
  for (const [key, template] of Object.entries(templates)) {
    walkObjects(template, (object, path) => {
      const values = readBlackboard(object.blackboard)
      if (!values.length) return
      index.add({ id: `${file}:${key}:${path}`, kind: 'inline', label: `${key} · 内嵌 Buff 黑板`, conditions: [], file, path: `${key}${path.slice(1)}.blackboard`, values },
        explicitTargets(object, values).map(t => ({ ...t, evidence: `${key} ${path} → ${t.evidence}（仅此处显式参数）` })))
    })
  }
}

export function buildSeasonBlackboardIndex(data: ObjectData | undefined, templates: Templates): BlackboardShard {
  const index = createBlackboardIndex(templates)
  for (const [id, buffs] of Object.entries(data?.effectBuffInfoDataDict ?? {})) {
    if (!Array.isArray(buffs)) continue
    buffs.forEach((buff, i) => {
      const values = readBlackboard(buff.blackboard)
      index.add({ id: `season:effects:${id}:${i}`, kind: 'season', label: `${data?.effectInfoDataDict?.[id]?.effectName || id} · 效果`, conditions: [`条目 ${i + 1}`, buff.key], file: '当前赛季', path: `effectBuffInfoDataDict.${id}[${i}].blackboard`, values,
        navigation: data?.effectInfoDataDict?.[id] ? { module: 'effects', id } : undefined }, explicitTargets(buff, values))
    })
  }
  for (const [id, raw] of Object.entries(data?.garrisonDataDict ?? {})) {
    const entry = raw as ObjectData
    const values = readBlackboard(entry.blackboard)
    index.add({ id: `season:garrison:${id}`, kind: 'season', label: `${id} · 特质`, conditions: [entry.description || '', entry.charLevel != null ? `棋子等级 ${entry.charLevel}` : '', entry.battleRuneKey || ''].filter(Boolean), file: '当前赛季', path: `garrisonDataDict.${id}.blackboard`, values, navigation: { module: 'garrison', id } }, explicitTargets(entry, values))
  }
  addInlineSources(index, data?.buffTemplates ?? {}, '当前赛季/buffTemplates')
  return { sources: index.sources, templates: index.bindings }
}

export interface BlackboardLink { key: string; path: string; evidence: string }
/** Direct edges only. Consumers navigate one hop; no recursive inheritance or cycles. */
export function collectBlackboardLinks(tree: unknown): BlackboardLink[] {
  const links: BlackboardLink[] = []
  walkObjects(tree, (node, path) => {
    if (!node.$type) return
    for (const field of ['_buffKey', '_templateKey', '_targetBuffKey']) if (typeof node[field] === 'string' && node[field]) {
      links.push({ key: node[field], path: `${path}.${field}`, evidence: `${node.$type.split('+').pop().split(',')[0]} · ${field}（引用不代表继承）` })
    }
    if (node._buff?.templateKey) links.push({ key: node._buff.templateKey, path: `${path}._buff`, evidence: `创建 Buff · 显式黑板 ${readBlackboard(node._buff.blackboard).length} 项；其他参数是否传递取决于运行时` })
  })
  return [...new Map(links.map(l => [`${l.key}:${l.path}`, l])).values()]
}
