#!/usr/bin/env node
/** Node 24+: node scripts/build-buff-blackboard-index.mjs --gamedata-root <Git checkout> */
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { createBlackboardIndex, readBlackboard, explicitTargets, addInlineSources } from '../packages/editor/src/components/editors/buff-editor/blackboardModel.ts'

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const arg = process.argv.indexOf('--gamedata-root')
if (arg < 0 || !process.argv[arg + 1]) throw new Error('Usage: --gamedata-root <GameData Git checkout> [--revision <commit>]')
const root = resolve(process.argv[arg + 1])
const git = (args, options = {}) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, ...options })
const revArg = process.argv.indexOf('--revision')
const revision = git(['rev-parse', '--verify', `${revArg >= 0 ? process.argv[revArg + 1] : 'HEAD'}^{commit}`]).trim()
const prefix = 'zh_CN/gamedata/'
const tree = git(['ls-tree', '-r', revision, '--', prefix]).trim().split('\n').map(line => {
  const [meta, path] = line.split('\t')
  return { oid: meta.split(' ')[2], path }
}).filter(e => e.path && (e.path === `${prefix}buff_table.json` || /^zh_CN\/gamedata\/(excel|battle|levels)\/.*\.(json|txt)$/.test(e.path)))
// Resolve promised blobs in one fetch; do not change the source checkout/sparse rules.
const objects = [...new Set(tree.map(e => e.oid))]
const availability = git(['cat-file', '--batch-check=%(objectname) %(objecttype)'], { input: objects.join('\n') + '\n', env: { ...process.env, GIT_NO_LAZY_FETCH: '1' } })
const missing = availability.trim().split('\n').filter(s => s.endsWith(' missing')).map(s => s.split(' ')[0])
if (missing.length) {
  console.log(`Fetching ${missing.length} missing GameData blobs at ${revision.slice(0, 12)}...`)
  git(['-c', 'fetch.negotiationAlgorithm=noop', 'fetch', '--no-tags', '--no-write-fetch-head', '--recurse-submodules=no', '--filter=blob:none', '--stdin', 'origin'], { input: missing.join('\n') + '\n', stdio: ['pipe', 'ignore', 'inherit'] })
}

function* readEntries(entries) {
  for (let start = 0; start < entries.length; start += 32) {
    const batch = entries.slice(start, start + 32)
    const output = git(['cat-file', '--batch'], { input: Buffer.from(batch.map(e => e.oid).join('\n') + '\n'), encoding: null })
    let offset = 0
    for (const entry of batch) {
      const end = output.indexOf(10, offset)
      const header = output.subarray(offset, end).toString('utf8').split(' ')
      if (header[1] !== 'blob') throw new Error(`Missing blob: ${entry.path}`)
      const size = Number(header[2])
      const content = output.subarray(end + 1, end + 1 + size).toString('utf8')
      offset = end + size + 2
      yield [entry.path.slice(prefix.length), entry.path.endsWith('.json') ? JSON.parse(content) : content]
    }
  }
}

const tables = new Map(readEntries(tree.filter(e => !e.path.includes('/levels/'))))
const officialTemplates = tables.get('battle/buff_template_data.json')
// Retained legacy editor keys participate in linking, without replacing either dataset.
const templates = { ...officialTemplates, ...JSON.parse(readFileSync(resolve(repo, 'packages/editor/public/buff_template_data.json'), 'utf8')) }
const index = createBlackboardIndex(templates)
const patchCharacters = tables.get('excel/char_patch_table.json')?.patchChars ?? {}
const characters = { ...tables.get('excel/character_table.json'), ...patchCharacters }
const skills = tables.get('excel/skill_table.json') ?? {}
const equips = tables.get('excel/uniequip_table.json')?.equipDict ?? {}
const skillOwners = new Map()
for (const [id, char] of Object.entries(characters)) for (const skill of char.skills ?? []) {
  const list = skillOwners.get(skill.skillId) ?? []
  list.push({ id, char, skill })
  skillOwners.set(skill.skillId, list)
}
const namedFamilies = (prefixes, evidence, matchKeys = false) => [...new Set(prefixes.filter(Boolean).flatMap(p => index.family(p)))].map(key => ({ key, confidence: 'candidate', evidence, matchKeys }))
const alias = id => id?.replace(/^(char|enemy|token|trap)_\d+_/, '')
const cond = o => [
  o.unlockCondition ? `精英 ${String(o.unlockCondition.phase).replace('PHASE_', '')} / 等级 ${o.unlockCondition.level}` : '',
  o.requiredPotentialRank != null ? `潜能 ${o.requiredPotentialRank + 1}` : '',
  o.validModeIndices?.length ? `模式 ${o.validModeIndices.join(', ')}` : '',
].filter(Boolean)
function add(file, path, object, options = {}) {
  const values = readBlackboard(object.blackboard ?? object.blackBoard ?? object.talentBlackboard)
  index.add({ id: `${file}:${path}`, kind: options.kind ?? 'mode', label: options.label ?? file, conditions: options.conditions ?? [], file, path, values },
    [...(options.targets ?? []), ...explicitTargets(object, values)])
}

for (const [id, char] of Object.entries(characters)) {
  const a = alias(id)
  const charFile = patchCharacters[id] ? 'excel/char_patch_table.json' : 'excel/character_table.json'
  const charPath = patchCharacters[id] ? `$.patchChars[${JSON.stringify(id)}]` : `$[${JSON.stringify(id)}]`
  for (const [i, talent] of (char.talents ?? []).entries()) for (const [j, candidate] of (talent.candidates ?? []).entries()) {
    add(charFile, `${charPath}.talents[${i}].candidates[${j}].blackboard`, candidate, { kind: 'talent', label: `${char.name} · ${candidate.name ?? `天赋 ${i + 1}`}`, conditions: cond(candidate),
      targets: [...namedFamilies([`${a}_t_${candidate.prefabKey}`], `角色 ${id} / 天赋 prefabKey=${candidate.prefabKey} 命名关联`), ...namedFamilies([`${a}_t${candidate.prefabKey}`], `角色 ${id} / 天赋 prefabKey=${candidate.prefabKey} 非标准命名与变量匹配`, true)] })
  }
  for (const [i, candidate] of (char.trait?.candidates ?? []).entries()) add(charFile, `${charPath}.trait.candidates[${i}].blackboard`, candidate, {
    kind: id.startsWith('char_') ? 'trait' : 'token', label: `${char.name} · 特性`, conditions: cond(candidate),
    targets: namedFamilies([a], `实体 ${id} 的特性黑板，与模板变量匹配`, true),
  })
}
for (const [id, skill] of Object.entries(skills)) for (const [level, data] of (skill.levels ?? []).entries()) {
  const owners = skillOwners.get(id) ?? []
  const prefab = data.prefabId ?? id
  const match = prefab.match(/^skchr_(.+)_(\d+)$/)
  const prefixes = [prefab, match ? `${match[1]}_s_${match[2]}` : '', ...owners.map(o => o.skill.overridePrefabKey)]
  add('excel/skill_table.json', `${id}.levels[${level}].blackboard`, data, { kind: 'skill', label: `${owners.map(o => o.char.name).join(' / ') || id} · ${data.name ?? id}`,
    conditions: [level < 7 ? `技能等级 ${level + 1}` : `专精 ${level - 6}`, `prefabId=${prefab}`],
    targets: [...namedFamilies(prefixes, `技能 ${id} / prefabId=${prefab} 命名关联`), ...namedFamilies([match ? `${match[1]}_s${match[2]}` : ''], `技能 ${id} / prefabId=${prefab} 非标准命名与变量匹配`, true)] })
}
for (const [id, equip] of Object.entries(tables.get('excel/battle_equip_table.json') ?? {})) {
  const info = equips[id] ?? {}
  const char = characters[info.charId]
  const a = alias(info.charId) ?? id.replace(/^uniequip_\d+_/, '')
  for (const [phaseIdx, phase] of (equip.phases ?? []).entries()) for (const [partIdx, part] of (phase.parts ?? []).entries()) {
    for (const bundle of ['addOrOverrideTalentDataBundle', 'overrideTraitDataBundle']) for (const [i, candidate] of (part[bundle]?.candidates ?? []).entries()) {
      const talentPrefixes = candidate.prefabKey && part.target !== 'TRAIT' ? [`${a}_t_${candidate.prefabKey}`, `${a}_t${candidate.prefabKey}`] : []
      add('excel/battle_equip_table.json', `${id}.phases[${phaseIdx}].parts[${partIdx}].${bundle}.candidates[${i}].blackboard`, candidate, {
        kind: 'equip', label: `${char?.name ?? a} · ${info.uniEquipName ?? id}`, conditions: [`模组等级 ${phase.equipLevel}`, part.target, part.isToken ? '作用于召唤物' : '', part.validInGameTag ? `对局标签 ${part.validInGameTag}` : '', part.validInMapTag ? `地图标签 ${part.validInMapTag}` : '', ...cond(candidate)].filter(Boolean),
        targets: namedFamilies([part.resKey, ...talentPrefixes, ...(part.target === 'TRAIT' ? [a] : [])], `模组 ${id} / resKey=${part.resKey ?? '无'} / ${part.target}，独立展示覆盖项`, true),
      })
    }
  }
}

function enemySources(file, path, id, data, conditions) {
  const a = alias(id)
  const name = data.name?.m_defined ? data.name.m_value : id
  const prefixes = [`enemy_${a}`, a]
  add(file, `${path}.talentBlackboard`, { blackboard: data.talentBlackboard }, { kind: 'enemy', label: `${name} · 敌人天赋`, conditions,
    targets: namedFamilies(prefixes, `敌人 ${id} 归属与变量匹配；前缀映射为候选`, true) })
  for (const [i, skill] of (data.skills ?? []).entries()) add(file, `${path}.skills[${i}].blackboard`, skill, {
    kind: 'enemy', label: `${name} · ${skill.prefabKey}`, conditions: [...conditions, `技能 ${skill.prefabKey}`],
    targets: namedFamilies(prefixes, `敌人 ${id} / 技能 ${skill.prefabKey} 归属与变量匹配`, true),
  })
}

// Generic battle containers: explicit template/dispatch keys and qualified parameters.
// Context stays attached to each individual occurrence, including level overrides.
function scan(file, rootValue, basePath = '$') {
  function walk(value, path, context) {
    if (!value || typeof value !== 'object') return
    if (Array.isArray(value)) { value.forEach((v, i) => walk(v, `${path}[${i}]`, context)); return }
    const next = { ...context }
    if (typeof value.id === 'string' && /^(enemy|char|token|trap)_/.test(value.id)) next.entityId = value.id
    if (value.inst?.characterKey) next.entityId = value.inst.characterKey
    if (value.characterKey) next.entityId = value.characterKey
    if (typeof value.prefabKey === 'string') next.prefabKey = value.prefabKey
    next.conditions = [...(context.conditions ?? [])]
    for (const [field, label] of [['difficultyMask', '难度'], ['professionMask', '职业'], ['buildableMask', '地块类型']]) {
      if (value[field] != null) next.conditions.push(`${label}=${value[field]}`)
    }
    if (next.entityId && typeof value.level === 'number') next.conditions.push(`实体等级 ${value.level}`)
    if (value.selector != null) next.conditions.push(`选择条件 ${JSON.stringify(value.selector)}`)
    const bb = value.blackboard ?? value.blackBoard ?? value.talentBlackboard
    if (Array.isArray(bb) && bb.length) {
      const entity = next.entityId
      const a = alias(entity)
      add(file, path, value, { kind: file.startsWith('levels/') ? 'level' : 'mode', label: `${file.startsWith('levels/') ? '关卡' : '活动 / 模式'} · ${entity ?? value.name ?? value.key ?? file.split('/').pop()}`,
        conditions: [file, ...next.conditions, next.prefabKey ? `prefabKey=${next.prefabKey}` : '', /overwrittenData|override/.test(path) ? '关卡覆盖项（未与基础值合并）' : ''].filter(Boolean),
        targets: a ? namedFamilies([a, `enemy_${a}`], `关卡实体 ${entity}${next.prefabKey ? ` / ${next.prefabKey}` : ''} 与模板变量匹配`, true) : [] })
    }
    for (const [k, v] of Object.entries(value)) walk(v, `${path}.${k}`, next)
  }
  walk(rootValue, basePath, {})
}

const handled = new Set(['excel/character_table.json', 'excel/skill_table.json', 'excel/battle_equip_table.json', 'battle/buff_template_data.json'])
for (const [file, data] of tables) if (file.endsWith('.json') && !handled.has(file)) scan(file, data)
addInlineSources(index, officialTemplates, 'battle/buff_template_data.json')
let levelCount = 0
for (const [file, data] of readEntries(tree.filter(e => e.path.includes('/levels/')))) {
  if (file === 'levels/enemydata/enemy_database.json') {
    for (const [enemyIndex, enemy] of data.enemies.entries()) for (const [entryIndex, entry] of enemy.Value.entries()) enemySources(file, `$.enemies[${enemyIndex}].Value[${entryIndex}].enemyData`, enemy.Key, entry.enemyData, [enemy.Key, `敌人等级 ${entry.level}`, '该等级声明值；未声明项不补零'])
  } else { scan(file, data); levelCount++ }
}

const output = resolve(repo, 'packages/editor/public/buff-blackboard')
mkdirSync(output, { recursive: true })
const digest = text => createHash('sha256').update(text).digest('hex').slice(0, 16)
const groups = new Map()
for (const [key, bindings] of Object.entries(index.bindings).sort(([a], [b]) => a.localeCompare(b))) {
  const bucket = createHash('sha256').update(key).digest()[0] % 32
  const shard = groups.get(bucket) ?? { sources: {}, templates: {} }
  shard.templates[key] = bindings
  for (const binding of bindings) shard.sources[binding.sourceId] = index.sources[binding.sourceId]
  groups.set(bucket, shard)
}
const locations = {}
let bytes = 0
for (const [bucket, shard] of groups) {
  const json = JSON.stringify(shard)
  const name = `${bucket.toString().padStart(2, '0')}-${digest(json)}.json`
  writeFileSync(resolve(output, name), json + '\n')
  bytes += Buffer.byteLength(json)
  for (const key of Object.keys(shard.templates)) locations[key] = name
}
const linked = new Set(Object.values(index.bindings).flat().map(b => b.sourceId))
const manifest = { schemaVersion: 1, revision, dataVersion: String(tables.get('excel/data_version.txt') ?? '').trim(),
  coverage: { files: tree.length, levels: levelCount, sources: Object.keys(index.sources).length, linkedSources: linked.size, templates: Object.keys(locations).length }, templates: locations }
writeFileSync(resolve(output, 'manifest.json'), JSON.stringify(manifest) + '\n')
const activeFiles = new Set(Object.values(locations))
for (const file of readdirSync(output)) if (/^\d{2}-[a-f0-9]{16}\.json$/.test(file) && !activeFiles.has(file)) unlinkSync(resolve(output, file))
console.log(JSON.stringify({ revision, ...manifest.coverage, shardBytes: bytes, shards: groups.size }, null, 2))
