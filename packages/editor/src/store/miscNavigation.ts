export const miscPages = [
  { module: 'modes', label: '模式', group: '模式与战斗', fields: 'modeDataDict scaling bountyGroups runtimeConfig.clientResources.modeAliases' },
  { module: 'boss', label: 'BOSS', group: '模式与战斗', fields: 'bossInfoDict bossResources' },
  { module: 'misc:stage', label: '关卡', group: '模式与战斗', fields: 'stageDatasDict' },
  { module: 'misc:battle', label: '战斗模板', group: '模式与战斗', fields: 'battleDataDict' },
  { module: 'shop', label: '商店', group: '商店与成长', fields: 'shopLevelDataDict shopLevelDisplayDataDict constData' },
  { module: 'misc:economy', label: '经济 / 商店 / 容量', group: '商店与成长', fields: 'runtimeConfig.economy runtimeConfig.shop constData' },
  { module: 'rewards', label: '奖励', group: '商店与成长', fields: 'baseRewardDataList difficultyFactorInfo modeFactorInfo runtimeConfig.rewardPools' },
  { module: 'misc:band', label: '策略组', group: '商店与成长', fields: 'bandDataListDict' },
  { module: 'misc:milestone', label: '里程碑', group: '商店与成长', fields: 'milestoneList' },
  { module: 'misc:playerTitle', label: '玩家称号', group: '商店与成长', fields: 'playerTitleDataDict' },
  { module: 'misc:enemy', label: '敌人分类', group: '敌人与训练', fields: 'enemyInfoDict' },
  { module: 'misc:specialEnemy', label: '特殊敌人', group: '敌人与训练', fields: 'specialEnemyInfoDict' },
  { module: 'misc:specialRandomType', label: '特殊敌人权重', group: '敌人与训练', fields: 'specialEnemyRandomTypeDict' },
  { module: 'misc:trainingNpc', label: '训练 NPC', group: '敌人与训练', fields: 'trainingNpcList' },
  { module: 'misc:clientResources', label: '客户端资源 / 预载', group: '资源与规则', fields: 'runtimeConfig.clientResources preloadEnemies enemyResources icons modeAliases' },
  { module: 'misc:constData', label: '常量', group: '资源与规则', fields: 'constData' },
  { module: 'misc:banConfig', label: 'Ban', group: '资源与规则', fields: 'banConfig' },
  { module: 'misc:diy', label: 'DIY 棋子', group: '资源与规则', fields: 'diyChessDict' },
  { module: 'misc:effectChoice', label: '效果选项', group: '资源与规则', fields: 'effectChoiceInfoDict' },
  { module: 'misc:diagnostics', label: '诊断 / 引用', group: '检查工具', fields: 'diagnostics references' },
  { module: 'diff', label: '对比', group: '检查工具', fields: 'diff compare' },
] as const

export type MiscModule = typeof miscPages[number]['module']
export type MiscPanel = Extract<MiscModule, `misc:${string}`> extends `misc:${infer Page}` ? Page : never
export function getMiscPage(module: string) { return miscPages.find(page => page.module === module) }
export function isMiscModule(module: string): module is MiscModule { return !!getMiscPage(module) }
export function filterMiscPages(query: string) {
  const words = query.toLowerCase().trim().split(/\s+/)
  return miscPages.filter(page => words.every(word => `${page.label} ${page.group} ${page.fields}`.toLowerCase().includes(word)))
}
