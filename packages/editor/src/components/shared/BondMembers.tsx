import { useMemo, useState } from 'react'
import { ActionIcon, Badge, Button, Checkbox, Divider, Group, Modal, ScrollArea, Select, Stack, Text, TextInput, Tooltip } from '@mantine/core'
import { IconPlus, IconTrash } from '@tabler/icons-react'
import { getChessName } from '@autochess-editor/shared'
import type { DataStore } from '../../store/dataStore'
import { useCollabField } from '../../hooks/useCollabField'
import { buildChessPairs, type ChessPair, type ChessVersionScope } from './bondMembership'
import { useBondMembership } from './useBondMembership'
import { matchesSearch } from './listFilters'

export function BondMembers({ store, bondId }: { store: DataStore; bondId: string }) {
  const data = store.activeSeason!.data, bond = data.bondInfoDict[bondId]
  const pairs = useMemo(() => buildChessPairs(data), [data])
  const membership = useBondMembership(store)
  const field = useCollabField(bondId, 'chessIdList')
  const [opened, setOpened] = useState(false), [search, setSearch] = useState('')
  const [scope, setScope] = useState<ChessVersionScope>('both')
  const [level, setLevel] = useState<string | null>(null), [hidden, setHidden] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const disabled = !!store.activeSeason!.readOnly || field.readOnly
  const members = new Set(bond.chessIdList)
  const name = (pair: ChessPair) => getChessName(pair.normalId ?? pair.id, data.charShopChessDatas, data.chessNormalIdLookupDict)
  const shop = (pair: ChessPair) => data.charShopChessDatas[pair.normalId ?? pair.id]
  const compare = (a: ChessPair, b: ChessPair) => (shop(a)?.chessLevel ?? 0) - (shop(b)?.chessLevel ?? 0)
    || (shop(a)?.shopLevelSortId ?? 0) - (shop(b)?.shopLevelSortId ?? 0)
    || a.id.localeCompare(b.id, undefined, { numeric: true })
  const all = [...new Map([...pairs.values()].filter(pair => pair.ids.length).map(pair => [pair.id, pair])).values()]
    .sort(compare)
  const rows = [...new Map(bond.chessIdList.map(id => {
    const pair = pairs.get(id) ?? { id, ids: [], conflict: false }
    return [pair.id, pair] as const
  })).values()].sort(compare)
  const candidates = all.filter(pair => (hidden || !shop(pair)?.isHidden) && (!level || String(shop(pair)?.chessLevel) === level)
    && matchesSearch([name(pair), pair.id, ...pair.ids, `${shop(pair)?.chessLevel ?? ''}星`], search))
  const targets = (pair: ChessPair) => scope === 'both' ? pair.ids : [scope === 'normal' ? pair.normalId : pair.goldenId].filter((id): id is string => !!id && pair.ids.includes(id))
  const unavailable = (pair: ChessPair) => (scope === 'both' && pair.conflict) || !targets(pair).length || targets(pair).every(id => members.has(id)) || membership.locked(bondId, [pair.id, ...pair.ids])
  const selectable = selected.filter(id => { const pair = pairs.get(id); return pair && !unavailable(pair) })
  const toggle = (id: string, checked: boolean) => setSelected(current => checked ? [...new Set([...current, id])] : current.filter(value => value !== id))
  return <Stack gap="xs" onFocusCapture={field.onFocus} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) field.onBlur() }}>
    <Divider label={`所属棋子（${rows.length} 个棋子／${members.size} 个版本）`} labelPosition="left" />
    <Group justify="space-between">
      <Text size="xs" c="dimmed">点击版本状态可单独加入或移除。</Text>
      <Button size="xs" variant="light" leftSection={<IconPlus size={14} />} disabled={disabled} onClick={() => {
        setSelected([]); setSearch(''); setLevel(null); setHidden(false); setScope('both'); setOpened(true)
      }}>添加棋子</Button>
    </Group>
    {!rows.length && <Text size="sm" c="dimmed">尚未添加棋子</Text>}
    {rows.map(pair => <Group key={pair.id} role="group" aria-label={`${name(pair)}的盟约版本`} gap="sm" justify="space-between" p="xs" style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}>
      <Tooltip label={[...new Set([pair.normalId, pair.goldenId, pair.id].filter(Boolean))].join(' / ')}>
        <Button variant="subtle" size="compact-sm" style={{ maxWidth: '100%' }} disabled={!shop(pair)} onClick={() => store.navigateTo('chess', pair.normalId ?? pair.id)}>
          <Text size="sm" truncate>{name(pair)}</Text>
        </Button>
      </Tooltip>
      <Group gap="sm">
        {shop(pair) && <Badge size="sm" variant="light">{shop(pair).chessLevel} 星</Badge>}
        {shop(pair)?.isHidden && <Badge size="xs" color="gray">隐藏</Badge>}
        {pair.conflict && <Text size="xs" c="orange">关联冲突</Text>}
        {(['normal', 'golden'] as const).map(version => {
          const id = version === 'normal' ? pair.normalId : pair.goldenId
          const exists = !!id && pair.ids.includes(id)
          return <Checkbox key={version} size="xs" label={`${version === 'normal' ? '普通' : '精锐'}${exists ? '' : pair.conflict ? '（未配对）' : '（缺失）'}`}
            checked={!!id && members.has(id)} disabled={disabled || !exists || membership.locked(bondId, [pair.id, ...pair.ids])}
            onChange={event => membership.commit(bondId, [{ chessId: pair.id, scope: version, present: event.currentTarget.checked }])} />
        })}
        <Tooltip label={pair.conflict ? '关联冲突，请用版本状态单独移除' : '移除普通和精锐版本'}>
          <ActionIcon variant="subtle" color="red" aria-label={`移除 ${name(pair)}`} disabled={disabled || pair.conflict || membership.locked(bondId, [pair.id, ...pair.ids])}
            onClick={() => membership.commit(bondId, [{ chessId: pair.id, scope: 'both', present: false }])}><IconTrash size={16} /></ActionIcon>
        </Tooltip>
      </Group>
    </Group>)}
    <Modal opened={opened} onClose={() => setOpened(false)} title="添加盟约棋子" size="lg">
      <Stack gap="sm">
        <TextInput ref={field.followRef as React.RefObject<HTMLInputElement>} label="搜索棋子" placeholder="名称、ID 或星级" value={search} onChange={event => setSearch(event.currentTarget.value)} />
        <Group grow>
          <Select label="版本范围" value={scope} onChange={value => { setScope(value as ChessVersionScope); setSelected([]) }}
            data={[{ value: 'both', label: '普通＋精锐' }, { value: 'normal', label: '仅普通' }, { value: 'golden', label: '仅精锐' }]} />
          <Select label="星级" placeholder="全部星级" clearable value={level} onChange={setLevel} data={[1, 2, 3, 4, 5, 6].map(value => ({ value: String(value), label: `${value} 星` }))} />
        </Group>
        <Checkbox label="显示隐藏棋子" checked={hidden} onChange={event => setHidden(event.currentTarget.checked)} />
        <ScrollArea.Autosize mah={340}>
          <Stack gap="xs">
            {candidates.map(pair => <Checkbox key={pair.id} checked={selected.includes(pair.id)} disabled={disabled || unavailable(pair)} onChange={event => toggle(pair.id, event.currentTarget.checked)}
              label={<Stack gap={0}><Text size="sm">{name(pair)} · {shop(pair)?.chessLevel ?? '?'} 星{shop(pair)?.isHidden ? ' · 隐藏' : ''}</Text>
                <Text size="xs" c="dimmed" style={{ overflowWrap: 'anywhere' }}>{pair.id}{pair.conflict ? ' · 关联冲突，仅可单版本操作' : pair.ids.length < 2 ? ' · 另一个版本缺失' : ''}{targets(pair).length && targets(pair).every(id => members.has(id)) ? ' · 已加入' : ''}</Text></Stack>} />)}
            {!candidates.length && <Text c="dimmed" size="sm">没有符合条件的棋子</Text>}
          </Stack>
        </ScrollArea.Autosize>
        <Group justify="space-between"><Text size="xs" c="dimmed">已选择 {selectable.length} 个棋子</Text><Button disabled={disabled || !selectable.length} onClick={() => {
          if (membership.commit(bondId, selectable.map(chessId => ({ chessId, scope, present: true })))) setOpened(false)
        }}>添加所选棋子</Button></Group>
      </Stack>
    </Modal>
  </Stack>
}
