export const enemyPages = [
  { module: 'enemy:classification', label: '敌人分类', group: '敌人', fields: 'enemyInfoDict' },
  { module: 'enemy:special', label: '特殊敌人', group: '敌人', fields: 'specialEnemyInfoDict' },
  { module: 'enemy:weights', label: '特殊敌人权重', group: '敌人', fields: 'specialEnemyRandomTypeDict' },
] as const

export type EnemyModule = typeof enemyPages[number]['module']
export type LegacyEnemyModule = 'misc:enemy' | 'misc:specialEnemy' | 'misc:specialRandomType'
const legacyModules: Record<LegacyEnemyModule, EnemyModule> = {
  'misc:enemy': 'enemy:classification',
  'misc:specialEnemy': 'enemy:special',
  'misc:specialRandomType': 'enemy:weights',
}
export function normalizeEnemyModule<T extends string>(module: T): T | EnemyModule {
  return Object.hasOwn(legacyModules, module) ? legacyModules[module as LegacyEnemyModule] : module
}
export function getEnemyPage(module: string) {
  return enemyPages.find(page => page.module === normalizeEnemyModule(module))
}
export function isEnemyModule(module: string): module is EnemyModule {
  return enemyPages.some(page => page.module === module)
}
