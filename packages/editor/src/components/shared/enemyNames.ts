import index from '../../data/enemy-names.json'

const names: Readonly<Record<string, string>> = index.names

export function getEnemyName(id: string): string | undefined {
  return Object.hasOwn(names, id) ? names[id] : undefined
}

export function getEnemyWikiUrl(id: string): string | undefined {
  const name = getEnemyName(id)
  return name ? `https://prts.wiki/w/${encodeURIComponent(name)}` : undefined
}

export function matchesEnemy(id: string, query: string): boolean {
  const text = `${getEnemyName(id) ?? ''} ${id}`.toLowerCase()
  return query.toLowerCase().trim().split(/\s+/).every(word => text.includes(word))
}
