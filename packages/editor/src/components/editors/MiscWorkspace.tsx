import { useState } from 'react'
import { Box, Group, NavLink, ScrollArea, Select, Stack, Text, TextInput } from '@mantine/core'
import { IconSearch } from '@tabler/icons-react'
import type { DataStore } from '../../store/dataStore'
import { filterMiscPages, getMiscPage, miscPages, type MiscPanel } from '../../store/miscNavigation'
import { ModesEditor } from './ModesEditor'
import { BossEditor } from './BossEditor'
import { ShopEditor } from './ShopEditor'
import { RewardsEditor } from './RewardsEditor'
import { DiffViewer } from './DiffViewer'
import { MiscEditor } from './MiscEditor'

export function MiscWorkspace({ store }: { store: DataStore }) {
  const [search, setSearch] = useState('')
  const current = getMiscPage(store.activeModule) ?? miscPages[0]
  const matches = filterMiscPages(search)
  const groups = [...new Set(miscPages.map(page => page.group))]
  function content() {
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
        <Text size="xs" c="dimmed">其他 · 不常用配置</Text>
        <TextInput aria-label="搜索其他页面" placeholder="搜索页面或字段…" value={search} onChange={event => setSearch(event.currentTarget.value)} leftSection={<IconSearch size={14} />} size="xs" />
        <ScrollArea style={{ flex: 1 }} offsetScrollbars>
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
        <Box p="sm" hiddenFrom="md">
          <Select label="其他页面" searchable value={current.module} data={groups.map(group => ({ group, items: miscPages.filter(page => page.group === group).map(page => ({ value: page.module, label: page.label })) }))}
            filter={({ search: query, options }) => options.map(option => 'group' in option ? { ...option, items: option.items.filter(item => filterMiscPages(query).some(page => page.module === item.value)) } : option)}
            onChange={module => { const page = module && getMiscPage(module); if (page) store.navigateTo(page.module) }} />
        </Box>
        <Text size="sm" c="dimmed" px="lg" py="sm">其他 / {current.group} / {current.label}</Text>
        <ScrollArea style={{ flex: 1 }} p="lg" pt={0} offsetScrollbars>
          <Box key={`${store.activeSeasonId}:${current.module}`}>{content()}</Box>
        </ScrollArea>
      </Stack>
    </Group>
  )
}
