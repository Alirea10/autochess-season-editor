// Node 24+: node --test scripts/test-season-directory.mjs
// Optional real-season regression: set SEASON_FIXTURE to a JSON path (read only).
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { registerHooks } from 'node:module'
import { extname } from 'node:path'
import test from 'node:test'

// The production shared package uses bundler-style extensionless TS imports.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('.') && !extname(specifier)) {
      return nextResolve(`${specifier}.ts`, context)
    }
    return nextResolve(specifier, context)
  },
})

const { saveToDirectory, loadFromDirectory } = await import('../packages/editor/src/store/fsStore.ts')
const { normalizeSeasonDataForJson } = await import('../packages/shared/src/utils.ts')

class MemoryDirectory {
  kind = 'directory'
  children = new Map()

  constructor(name = 'season', events = [], path = name) {
    this.name = name
    this.events = events
    this.path = path
  }

  async getDirectoryHandle(name, { create = false } = {}) {
    if (!this.children.has(name)) {
      if (!create) throw new DOMException('Missing directory', 'NotFoundError')
      this.children.set(name, new MemoryDirectory(name, this.events, `${this.path}/${name}`))
    }
    const entry = this.children.get(name)
    if (entry.kind !== 'directory') throw new DOMException('Not a directory', 'TypeMismatchError')
    return entry
  }

  async getFileHandle(name, { create = false } = {}) {
    if (!this.children.has(name)) {
      if (!create) throw new DOMException('Missing file', 'NotFoundError')
      this.children.set(name, { kind: 'file', name, content: '' })
    }
    const entry = this.children.get(name)
    if (entry.kind !== 'file') throw new DOMException('Not a file', 'TypeMismatchError')
    return {
      kind: 'file', name,
      getFile: async () => ({ text: async () => entry.content }),
      createWritable: async () => {
        let pending = entry.content
        return {
          write: async (content) => { pending = content },
          close: async () => {
            this.events.push(`write:${this.path}/${name}`)
            entry.content = pending
          },
        }
      },
    }
  }

  async *entries() {
    yield* this.children.entries()
  }

  async removeEntry(name) {
    assert(this.children.has(name))
    this.events.push(`remove:${this.path}/${name}`)
    this.children.delete(name)
  }

  readJson(name = 'project.json') {
    return JSON.parse(this.children.get(name).content)
  }
}

function makeSeason() {
  return {
    bondInfoDict: {}, charChessDataDict: {}, trapChessDataDict: {},
    constData: { shopRefreshPrice: 0 },
    banConfig: { mode: 'banCore', coreBondIds: [], coreBondBanCount: 0 },
    runtimeConfig: { version: 1, futureFeature: { enabled: false, count: 0, entries: [] } },
    extensionZero: 0, extensionFalse: false, extensionEmpty: [], extensionNull: null,
    futureDataDict: { sample: { list: [], disabled: false } },
    buffTemplates: {
      sample: {
        templateKey: 'sample', effectKey: 'custom', onEventPriority: 'DEFAULT',
        eventToActions: { EVENT: [{ $type: 'FutureAction', unknownValue: 0, list: [] }] },
      },
    },
  }
}

test('JSON → production directory save/load → JSON preserves extensions and custom buff nodes', async () => {
  const dir = new MemoryDirectory()
  const source = makeSeason()
  await saveToDirectory(dir, source, 'test')
  const { data, meta } = await loadFromDirectory(dir)
  const exported = JSON.parse(JSON.stringify(normalizeSeasonDataForJson(data)))
  for (const key of Object.keys(source)) assert.deepEqual(exported[key], source[key], key)
  assert.equal(meta.version, 1)
  assert.equal(meta.constFields.buffTemplates, undefined)
  assert.equal(meta.constFields.bondInfoDict, undefined)
  assert.deepEqual(meta.constFields.futureDataDict, source.futureDataDict)
  assert.deepEqual((await dir.getDirectoryHandle('buffTemplates')).readJson('sample.json'), source.buffTemplates.sample)
})

test('incremental saves persist extension additions, changes, removals, and simultaneous label changes', async () => {
  const dir = new MemoryDirectory()
  const source = makeSeason()
  await saveToDirectory(dir, source, 'before')
  const changed = structuredClone(source)
  changed.runtimeConfig.futureFeature.count = 3
  changed.addedField = { empty: [], off: false }
  delete changed.futureDataDict
  changed.buffTemplates.sample.effectKey = 'changed'
  await saveToDirectory(dir, changed, 'after', undefined, undefined, source)
  const { data, meta } = await loadFromDirectory(dir)
  assert.equal(meta.label, 'after')
  assert.equal(data.runtimeConfig.futureFeature.count, 3)
  assert.deepEqual(data.addedField, { empty: [], off: false })
  assert.equal(Object.hasOwn(data, 'futureDataDict'), false)
  assert.equal(data.buffTemplates.sample.effectKey, 'changed')

  const dictOnly = structuredClone(changed)
  dictOnly.buffTemplates.sample.effectKey = 'dict-only'
  await saveToDirectory(dir, dictOnly, 'label-with-dict-edit', undefined, undefined, changed)
  assert.equal((await loadFromDirectory(dir)).meta.label, 'label-with-dict-edit')
})

test('same incremental baseline repairs fields omitted by the old metadata whitelist', async () => {
  const dir = new MemoryDirectory()
  const source = makeSeason()
  await saveToDirectory(dir, source, 'test')
  const oldMeta = dir.readJson()
  delete oldMeta.constFields.runtimeConfig
  delete oldMeta.constFields.futureDataDict
  dir.children.get('project.json').content = JSON.stringify(oldMeta)
  await saveToDirectory(dir, source, 'test', undefined, undefined, source)
  assert.deepEqual(dir.readJson().constFields.runtimeConfig, source.runtimeConfig)
  assert.deepEqual(dir.readJson().constFields.futureDataDict, source.futureDataDict)
})

test('clearing the only changed dictionary deletes old files even when no files need writing', async () => {
  const dir = new MemoryDirectory()
  const source = makeSeason()
  await saveToDirectory(dir, source, 'test')
  const changed = { ...source, buffTemplates: {} }
  dir.events.length = 0
  await saveToDirectory(dir, changed, 'test', () => dir.events.push('before'), undefined, source)
  assert.deepEqual((await loadFromDirectory(dir)).data.buffTemplates, {})
  assert.deepEqual(dir.events, ['before', 'remove:season/buffTemplates/sample.json'])
})

test('removing an optional dictionary does not restore old entries on reload', async () => {
  const dir = new MemoryDirectory()
  const source = makeSeason()
  await saveToDirectory(dir, source, 'test')
  const changed = { ...source }
  delete changed.buffTemplates
  await saveToDirectory(dir, changed, 'test', undefined, undefined, source)
  assert.deepEqual((await loadFromDirectory(dir)).data.buffTemplates, {})
})

test('writes preserve CRLF and trailing-newline format; unchanged saves do not write', async () => {
  const dir = new MemoryDirectory()
  const source = makeSeason()
  await saveToDirectory(dir, source, 'test')
  const project = dir.children.get('project.json')
  project.content = JSON.stringify(JSON.parse(project.content), null, 2).replace(/\n/g, '\r\n') + '\r\n\r\n'
  const buffs = await dir.getDirectoryHandle('buffTemplates')
  const sample = buffs.children.get('sample.json')
  sample.content = sample.content.trimEnd()
  dir.events.length = 0
  await saveToDirectory(dir, source, 'test', () => dir.events.push('before'), undefined, source)
  assert.deepEqual(dir.events, [])
  const changed = structuredClone(source)
  changed.extensionZero = 2
  changed.buffTemplates.sample.effectKey = 'new'
  await saveToDirectory(dir, changed, 'test', () => dir.events.push('before'), undefined, source)
  assert.equal(dir.events[0], 'before')
  assert.equal(dir.events.filter(e => e === 'before').length, 1)
  assert(project.content.endsWith('\r\n\r\n'))
  assert(!project.content.replace(/\r\n/g, '').includes('\n'))
  assert(!sample.content.endsWith('\n'))
})

test('real season round-trip preserves all normalized semantics and expected declaration counts', {
  skip: !process.env.SEASON_FIXTURE,
}, async () => {
  const source = JSON.parse(await readFile(process.env.SEASON_FIXTURE, 'utf8'))
  const dir = new MemoryDirectory()
  await saveToDirectory(dir, source, 'real regression')
  const { data } = await loadFromDirectory(dir)
  assert.deepEqual(normalizeSeasonDataForJson(data), normalizeSeasonDataForJson(source))
  assert.equal(data.banConfig.coreBondIds.length, 12)
  assert.equal(Object.keys(data.specialEnemyInfoDict).length, 67)
  assert.equal(Object.keys(data.buffTemplates).length, 33)
})

test('runtime reward pools and client resources round-trip without losing empty, zero, false or extensions', async () => {
  const source = makeSeason()
  source.runtimeConfig = { version: 1, rewardPools: { empty: [], custom: [{ chessId: 'new', value: 0 }] }, clientResources: { preloadEnemies: [], enemyResources: { enemy_new: { level: 0, isFlyEnemy: false, extraEnemyKeyList: [], future: 7 } }, icons: { new_icon: { path: 'icon/new.png', url: 'https://example.com/new.png' } }, modeAliases: {}, future: { disabled: false } } }
  const dir = new MemoryDirectory()
  await saveToDirectory(dir, source, 'phase5')
  assert.deepEqual((await loadFromDirectory(dir)).data.runtimeConfig, source.runtimeConfig)
})


test('corrupt dictionary file blocks load and all writes, including planned deletion', async () => {
  const dir = new MemoryDirectory()
  const source = makeSeason()
  await saveToDirectory(dir, source, 'safe')
  dir.children.get('buffTemplates').children.get('sample.json').content = '{broken'
  const before = dir.events.length
  await assert.rejects(loadFromDirectory(dir), /buffTemplates.*sample\.json/)
  await assert.rejects(saveToDirectory(dir, {...source, buffTemplates:{}}, 'changed', undefined, undefined, source), /sample\.json/)
  assert.equal(dir.events.length, before)
  assert.equal(dir.readJson().label, 'safe')
})

test('economy, mode rules and PE export preserve their respective semantics', async () => {
  const {normalizeSeasonDataForPeJson} = await import('../packages/shared/src/utils.ts')
  const source = makeSeason()
  source.runtimeConfig.shop = {charRates:[[],[1,0]],charStockByLevel:{1:0},equipStockByLevel:{}}
  source.runtimeConfig.economy = {incomeByDifficulty:{ABYSS:[]},freeRefreshByDifficulty:{FUNNY:[0]}}
  source.modeDataDict = {custom:{modeId:'custom',difficultyScaling:{enemyFactorsByRound:[],bossHpPerPlayer:false},bountyGroups:[]}}
  for (const field of ['bandDataListDict','bossInfoDict','charShopChessDatas','effectBuffInfoDataDict','effectChoiceInfoDict','effectInfoDataDict','garrisonDataDict','shopCharChessInfoData','shopLevelDisplayDataDict','specialEnemyInfoDict','stageDatasDict','trapShopChessDatas']) source[field] ??= {}
  const original = structuredClone(source)
  for (const normalize of [normalizeSeasonDataForJson,normalizeSeasonDataForPeJson]) {
    const expected = JSON.parse(JSON.stringify(normalize(source)))
    const dir = new MemoryDirectory()
    await saveToDirectory(dir,expected,'roundtrip')
    const loaded = await loadFromDirectory(dir)
    assert.deepEqual(normalizeSeasonDataForJson(loaded.data), normalizeSeasonDataForJson(expected))
  }
  assert.deepEqual(source,original)
})

test('current project round-trip uses a read-only source and an isolated directory', {skip:!process.env.SEASON_PROJECT}, async()=>{
  const {readdir} = await import('node:fs/promises')
  const {join} = await import('node:path')
  const disk = new MemoryDirectory()
  const root = process.env.SEASON_PROJECT
  for (const entry of await readdir(root,{withFileTypes:true})) {
    if (entry.isFile() && entry.name==='project.json') disk.children.set(entry.name,{kind:'file',name:entry.name,content:await readFile(join(root,entry.name),'utf8')})
    else if (entry.isDirectory() && !entry.name.startsWith('.')) {
      const sub = new MemoryDirectory(entry.name)
      for (const file of await readdir(join(root,entry.name),{withFileTypes:true})) if(file.isFile()&&file.name.endsWith('.json')) sub.children.set(file.name,{kind:'file',name:file.name,content:await readFile(join(root,entry.name,file.name),'utf8')})
      disk.children.set(entry.name,sub)
    }
  }
  const loaded = await loadFromDirectory(disk)
  const target = new MemoryDirectory()
  await saveToDirectory(target,loaded.data,loaded.meta.label)
  assert.deepEqual(normalizeSeasonDataForJson((await loadFromDirectory(target)).data),normalizeSeasonDataForJson(loaded.data))
  assert.equal(disk.events.length,0)
})
