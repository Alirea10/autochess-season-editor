#!/usr/bin/env node
/** node scripts/build-enemy-name-index.mjs --gamedata-root <Git checkout> [--revision <commit>] */
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const option = name => {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}
const root = option('--gamedata-root')
if (!root) throw new Error('Usage: --gamedata-root <Git checkout> [--revision <commit>]')
const git = args => execFileSync('git', args, { cwd: resolve(root), encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
const revision = git(['rev-parse', '--verify', `${option('--revision') ?? 'HEAD'}^{commit}`]).trim()
const databasePath = 'zh_CN/gamedata/levels/enemydata/enemy_database.json'
const databaseText = git(['show', `${revision}:${databasePath}`])
const database = JSON.parse(databaseText)
const handbookPath = 'zh_CN/gamedata/excel/enemy_handbook_table.json'
const handbookText = git(['show', `${revision}:${handbookPath}`])
const handbook = JSON.parse(handbookText).enemyData
if (!handbook || typeof handbook !== 'object' || Array.isArray(handbook)) throw new Error('Enemy handbook is malformed')
if (!Array.isArray(database.enemies) || !database.enemies.length) throw new Error('Enemy database is empty or malformed')
const names = {}
for (const { Key: id, Value: levels } of database.enemies) {
  if (!/^enemy_[a-z0-9_]+$/i.test(id) || Object.hasOwn(names, id) || !Array.isArray(levels)) throw new Error(`Invalid or duplicate enemy: ${id}`)
  // Level overrides inherit undefined names. Use the lowest explicitly named level;
  // preserve the full ID, including _2 / _3 variants.
  const name = [...levels].sort((a, b) => a.level - b.level)
    .find(level => level.enemyData?.name?.m_defined && typeof level.enemyData.name.m_value === 'string' && level.enemyData.name.m_value.trim())
    ?.enemyData.name.m_value.trim()
  if (!name) throw new Error(`Enemy name missing: ${id}`)
  // Handbook names match the public enemy catalogue; the database also covers
  // enemies hidden from that catalogue. Never infer a name from an ID prefix.
  names[id] = typeof handbook[id]?.name === 'string' && handbook[id].name.trim() || name
}
const output = {
  schemaVersion: 1,
  source: 'https://github.com/Kengxxiao/ArknightsGameData',
  revision,
  dataVersion: git(['show', `${revision}:zh_CN/gamedata/excel/data_version.txt`]).trim(),
  database: databasePath,
  databaseSha256: createHash('sha256').update(databaseText).digest('hex'),
  handbook: handbookPath,
  handbookSha256: createHash('sha256').update(handbookText).digest('hex'),
  count: Object.keys(names).length,
  names: Object.fromEntries(Object.entries(names).sort(([a], [b]) => a.localeCompare(b, 'en'))),
}
const destination = resolve(dirname(fileURLToPath(import.meta.url)), '../packages/editor/src/data/enemy-names.json')
mkdirSync(dirname(destination), { recursive: true })
writeFileSync(destination, JSON.stringify(output, null, 2) + '\n')
console.log(`Generated ${output.count} exact enemy names from ${revision}`)
