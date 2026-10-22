import { enemyPages, getEnemyPage, isEnemyModule } from '../../store/enemyNavigation'
import { EnemyEditor } from './EnemyEditor'
import { EditorPage } from '../shared/EditorLayout'
import { useState } from 'react'
import { Box, Group, NavLink, ScrollArea, Select, Stack, Text, TextInput } from '@mantine/core'
import { IconSearch } from '@tabler/icons-react'
import type { DataStore } from '../../store/dataStore'
import { getMiscPage, miscPages, type MiscPanel } from '../../store/miscNavigation'
import { ModesEditor } from './ModesEditor'
import { BossEditor } from './BossEditor'
import { ShopEditor } from './ShopEditor'
import { RewardsEditor } from './RewardsEditor'
import { DiffViewer } from './DiffViewer'
import { MiscEditor } from './MiscEditor'

export function MiscWorkspace({ store, section = 'misc' }: { store: DataStore; section?: 'misc' | 'enemies' }) {
  const [search, setSearch] = useState('')
  const pages = section === 'enemies' ? enemyPages : miscPages
  const sectionLabel = section === 'enemies' ? '敌人' : '其他'
  const current = (section === 'enemies' ? getEnemyPage(store.activeModule) : getMiscPage(store.activeModule)) ?? pages[0]
  const words = search.toLowerCase().trim().split(/\s+/)
  const matches = pages.filter(page => words.every(word => `${page.label} ${page.group} ${page.fields}`.toLowerCase().includes(word)))
  const groups = [...new Set(pages.map(page => page.group))]
  function content() {
    if (isEnemyModule(current.module)) return <EnemyEditor store={store} page={current.module} />
    switch (current.module) {
      case 'modes': return <ModesEditor store={store} />
      case 'boss': return <BossEditor store={store} />
      case 'shop': return <ShopEditor store={store} />
      case 'rewards': return <RewardsEditor store={store} />
      case 'diff': return <DiffViewer store={store} />
      default: return <MiscEditor store={store} page={current.module.slice(5) as MiscPanel} />
    }
  }
  return (
    <Group gap={0} align="stretch" wrap="nowrap" style={{ height: '100%', minHeight: 0 }}>
      <Stack visibleFrom="md" w={228} gap="sm" p="sm" style={{ flexShrink: 0, borderRight: '1px solid var(--mantine-color-dark-4)' }}>
        <Text size="xs" c="dimmed">{section === 'enemies' ? '敌人 · 分类与特殊敌人配置' : '其他 · 不常用配置'}</Text>
        <TextInput aria-label={`搜索${sectionLabel}页面`} placeholder="搜索页面或字段…" value={search} onChange={event => setSearch(event.currentTarget.value)} leftSection={<IconSearch size={14} />} size="xs" />
        <ScrollArea style={{ flex: 1, minHeight: 0 }} styles={{ viewport: { overscrollBehaviorY: 'contain' } }} offsetScrollbars>
          {groups.map(group => {
            const pages = matches.filter(page => page.group === group)
            return pages.length ? <Box key={group} mb="sm">
              <Text size="xs" fw={600} c="dimmed" px="xs" mb={4}>{group}</Text>
              {pages.map(page => <NavLink component="button" type="button" key={page.module} label={page.label} active={page.module === current.module}
                aria-current={page.module === current.module ? 'page' : undefined}
                onClick={() => store.navigateTo(page.module)} style={{ borderRadius: 6 }} />)}
            </Box> : null
          })}
          {!matches.length && <Text size="sm" c="dimmed">没有匹配的页面</Text>}
        </ScrollArea>
      </Stack>
      <Stack gap={0} style={{ flex: 1, minWidth: 0, minHeight: 0 }}>
        <Box p="sm" hiddenFrom="md" style={{ flexShrink: 0 }}>
          <Select label={`${sectionLabel}页面`} searchable value={current.module} data={groups.map(group => ({ group, items: pages.filter(page => page.group === group).map(page => ({ value: page.module, label: page.label })) }))}
            filter={({ search: query, options }) => options.map(option => 'group' in option ? { ...option, items: option.items.filter(item => pages.some(page => page.module === item.value && query.toLowerCase().trim().split(/\s+/).every(word => `${page.label} ${page.group} ${page.fields}`.toLowerCase().includes(word)))) } : option)}
            onChange={module => { const page = module && (getEnemyPage(module) ?? getMiscPage(module)); if (page) store.navigateTo(page.module) }} />
        </Box>
        <Text size="sm" c="dimmed" px="lg" py="sm" style={{ flexShrink: 0 }}>{sectionLabel} / {section === 'misc' ? `${current.group} / ` : ''}{current.label}</Text>
        <EditorPage key={`${store.activeSeasonId}:${current.module}`} module={current.module}>{content()}</EditorPage>
      </Stack>
    </Group>
  )
}
