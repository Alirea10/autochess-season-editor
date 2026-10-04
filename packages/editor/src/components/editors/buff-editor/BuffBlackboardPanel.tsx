import { useEffect, useMemo, useState } from 'react'
import { Accordion, Alert, Badge, Button, Code, Group, Loader, Modal, Paper, Select, Stack, Switch, Table, Text, TextInput } from '@mantine/core'
import { IconArrowRight, IconMaximize, IconSearch } from '@tabler/icons-react'
import type { Node, Edge } from '@xyflow/react'
import type { DataStore } from '../../../store/dataStore'
import { flushPendingEdits } from '../../../store/pendingEdits'
import { graphToTree, type FlowNodeData } from './graphConversion'
import { GRAPH_TREE_KEYS } from './constants'
import { useBuffEditor } from './BuffEditorContext'
import { loadTemplateBlackboard } from './blackboardData'
import { buildSeasonBlackboardIndex, collectBlackboardReferences, collectBlackboardLinks, type BlackboardReference, type BlackboardShard, type BlackboardManifest, type Templates } from './blackboardModel'

const KIND_NAMES: Record<string, string> = { season: '当前赛季', skill: '技能', talent: '天赋', trait: '特性', equip: '模组', token: '召唤物', enemy: '敌人', level: '关卡', mode: '活动 / 模式', inline: '内嵌 Buff' }
const SCOPE_NAMES = { buff: '本 Buff', otherBuff: '其他 Buff', ability: '能力', global: '全局' }
const EMPTY_TEMPLATES: Templates = {}
const runtimeCache = new WeakMap<Templates, Map<string, BlackboardReference[]>>()
function incomingWrites(templates: Templates) {
  let index = runtimeCache.get(templates)
  if (index) return index
  index = new Map()
  for (const [key, template] of Object.entries(templates)) for (const ref of collectBlackboardReferences(template)) {
    if (ref.scope !== 'otherBuff' || !ref.target || ref.access !== 'write') continue
    const list = index.get(ref.target) ?? []
    list.push({ ...ref, scope: 'buff', target: key, path: `${key}:${ref.path}`, detail: `来自 ${key} · ${ref.detail}` })
    index.set(ref.target, list)
  }
  runtimeCache.set(templates, index)
  return index
}

interface Props {
  store: DataStore
  activeKey: string
  origin: 'user' | 'ref'
  nodes: Node[]
  edges: Edge[]
  selectedNodeIds: Set<string>
}

export function BuffBlackboardPanel({ store, activeKey, origin, nodes, edges, selectedNodeIds }: Props) {
  const { refTemplates, goToDefinition } = useBuffEditor()
  const [remote, setRemote] = useState<{ key: string; shard: BlackboardShard; manifest: BlackboardManifest } | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [retry, setRetry] = useState(0)
  const [search, setSearch] = useState('')
  const [kind, setKind] = useState<string | null>(null)
  const [onlySelected, setOnlySelected] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [visibleCount, setVisibleCount] = useState(24)
  const data = store.activeSeason?.data
  const userTemplates = data?.buffTemplates ?? EMPTY_TEMPLATES
  const allTemplates = useMemo(() => ({ ...refTemplates, ...userTemplates }), [refTemplates, userTemplates])
  const local = useMemo(() => buildSeasonBlackboardIndex(data, allTemplates), [data, allTemplates])
  const tree = useMemo(() => graphToTree(nodes, edges), [nodes, edges])
  const refs = useMemo(() => collectBlackboardReferences(tree), [tree])
  const selectedRefs = useMemo(() => nodes.filter(n => selectedNodeIds.has(n.id)).flatMap(n => {
    // Graph children have their own selectable nodes; don't include stale copies
    // retained in the parent actionNode. Opaque nested actions remain inspectable.
    const action = (n.data as FlowNodeData).actionNode
    return collectBlackboardReferences(Object.fromEntries(Object.entries(action ?? {}).filter(([key]) => !GRAPH_TREE_KEYS.has(key))))
  }), [nodes, selectedNodeIds])
  const selectedKeys = new Set(selectedRefs.map(r => `${r.scope}:${r.key}`))
  const nodeFilter = onlySelected && selectedNodeIds.size > 0
  const writes = useMemo(() => [
    ...(incomingWrites(refTemplates ?? EMPTY_TEMPLATES).get(activeKey) ?? []).filter(r => origin === 'ref' || !userTemplates[r.target!]),
    ...(origin === 'user' ? incomingWrites(userTemplates).get(activeKey) ?? [] : []),
  ], [refTemplates, userTemplates, activeKey, origin])
  const links = useMemo(() => collectBlackboardLinks(tree), [tree])

  useEffect(() => {
    let current = true
    setLoading(true); setError(''); setRemote(null)
    loadTemplateBlackboard(activeKey).then(result => {
      if (current) setRemote({ key: activeKey, ...result })
    }).catch(e => { if (current) setError(e instanceof Error ? e.message : '黑板数据加载失败') })
      .finally(() => { if (current) setLoading(false) })
    return () => { current = false }
  }, [activeKey, retry])
  useEffect(() => { setKind(null); setSearch(''); setOnlySelected(false) }, [activeKey, origin, store.activeSeasonId])
  useEffect(() => { setVisibleCount(24) }, [search, kind, onlySelected, activeKey])

  const remoteShard = remote?.key === activeKey ? remote.shard : null
  const entries = [
    ...(local.templates[activeKey] ?? []).map(binding => ({ binding, source: local.sources[binding.sourceId], local: true })),
    ...(remoteShard?.templates[activeKey] ?? []).map(binding => ({ binding, source: remoteShard!.sources[binding.sourceId], local: false })),
  ].filter(entry => entry.source)
  const needle = search.trim().toLowerCase()
  const filtered = entries.filter(entry => !kind || (kind === 'season' ? entry.local : !entry.local && entry.source.kind === kind)).map(entry => ({
    ...entry,
    rows: entry.source.values.filter(row => {
      const mapped = entry.binding.keys[row.key]
      if (mapped === undefined || (nodeFilter && !selectedKeys.has(`buff:${mapped}`))) return false
      return !needle || [row.key, mapped, row.valueStr, row.value, entry.source.label].some(v => String(v ?? '').toLowerCase().includes(needle))
    }),
  })).filter(entry => entry.rows.length)
  const displayedRefs = [...refs, ...writes].filter(ref => (!nodeFilter || selectedKeys.has(`${ref.scope}:${ref.key}`)) && (!needle || ref.key.toLowerCase().includes(needle)))
  const groupedRefs = [...new Map(displayedRefs.map(ref => [`${ref.scope}:${ref.target ?? ''}:${ref.key}`, ref])).values()]
  const navigate = (module: 'effects' | 'garrison', id: string) => {
    flushPendingEdits()
    store.navigateTo(module, id)
  }
  const controls = (
    <Stack gap="xs">
      <TextInput size="xs" aria-label="搜索黑板变量" placeholder="搜索变量、数值或来源" leftSection={<IconSearch size={14} />} value={search} onChange={e => setSearch(e.currentTarget.value)} />
      <Select size="xs" aria-label="黑板来源类型" placeholder="全部来源" clearable value={kind} onChange={setKind} data={[...new Set(entries.map(e => e.local ? 'season' : e.source.kind))].map(value => ({ value, label: KIND_NAMES[value] ?? value }))} />
      <Switch size="xs" label="仅当前节点相关变量" checked={onlySelected} disabled={!selectedNodeIds.size} onChange={e => setOnlySelected(e.currentTarget.checked)} />
    </Stack>
  )
  const content = (full: boolean) => (
    <Stack gap="sm">
      {loading && <Group gap="xs"><Loader size="xs" /><Text size="xs">加载原版黑板来源…</Text></Group>}
      {error && <Alert color="orange" title="原版来源暂不可用"><Text size="xs">{error}</Text><Button size="compact-xs" mt="xs" onClick={() => setRetry(v => v + 1)}>重试加载</Button></Alert>}
      <Text size="xs" c="dimmed">数值按来源独立列出；候选关联和运行时写入不代表最终战斗数值。</Text>
      {filtered.length === 0 && <Text size="sm" c="dimmed">{entries.length ? '没有符合筛选条件的黑板值' : '未找到此模板的静态黑板来源'}</Text>}
      {filtered.slice(0, visibleCount).map(({ source, binding, rows, local: isLocal }) => (
        <Paper key={source.id} withBorder p="xs" radius="sm">
          <Stack gap={6}>
            <Group gap={4}>
              <Badge size="xs" color={isLocal ? 'teal' : 'blue'}>{isLocal ? '当前赛季' : KIND_NAMES[source.kind] ?? source.kind}</Badge>
              <Badge size="xs" color={binding.confidence === 'explicit' ? 'green' : 'orange'}>{binding.confidence === 'explicit' ? '明确引用' : '候选来源'}</Badge>
              {origin === 'ref' && isLocal && <Badge size="xs" color="gray">赛季使用参数</Badge>}
              {origin === 'user' && !isLocal && <Badge size="xs" color="gray">原版参考</Badge>}
            </Group>
            <Text size="xs" fw={600} style={{ overflowWrap: 'anywhere' }}>{source.label}</Text>
            {source.conditions.length > 0 && <Text size="xs" c="dimmed" style={{ overflowWrap: 'anywhere' }}>{source.conditions.join(' · ')}</Text>}
            {full ? (
              <Table striped withTableBorder style={{ tableLayout: 'fixed' }}>
                <Table.Thead><Table.Tr><Table.Th>变量 / 原始键</Table.Th><Table.Th>值</Table.Th></Table.Tr></Table.Thead>
                <Table.Tbody>{rows.map((row, i) => <Table.Tr key={`${row.key}:${i}`}>
                  <Table.Td style={{ overflowWrap: 'anywhere' }}><Code>{binding.keys[row.key]}</Code>{binding.keys[row.key] !== row.key && <Text size="xs" c="dimmed">原始键：{row.key}</Text>}</Table.Td>
                  <Table.Td style={{ overflowWrap: 'anywhere' }}><Code>{row.valueStr !== null ? JSON.stringify(row.valueStr) : row.value === null ? '未声明' : String(row.value)}</Code><Text size="xs" c="dimmed">{row.valueStr !== null ? `字符串 · value=${row.value ?? '未声明'}` : '数值'}</Text></Table.Td>
                </Table.Tr>)}</Table.Tbody>
              </Table>
            ) : rows.map((row, i) => <div key={`${row.key}:${i}`}>
              <Text size="xs" ff="monospace" style={{ overflowWrap: 'anywhere' }}>{binding.keys[row.key]} = {row.valueStr !== null ? JSON.stringify(row.valueStr) : row.value === null ? '未声明' : String(row.value)}</Text>
              {binding.keys[row.key] !== row.key && <Text size="10px" c="dimmed" style={{ overflowWrap: 'anywhere' }}>原始键：{row.key}</Text>}
            </div>)}
            <Accordion variant="default" styles={{ control: { padding: 0 }, content: { padding: '4px 0' } }}>
              <Accordion.Item value="evidence"><Accordion.Control><Text size="xs">来源与关联依据</Text></Accordion.Control><Accordion.Panel>
                <Text size="xs" style={{ overflowWrap: 'anywhere' }}>{binding.evidence}</Text>
                <Text size="10px" c="dimmed" style={{ overflowWrap: 'anywhere' }}>{source.file}<br />{source.path}</Text>
              </Accordion.Panel></Accordion.Item>
            </Accordion>
            {source.navigation && <Button variant="light" size="compact-xs" rightSection={<IconArrowRight size={12} />} onClick={() => navigate(source.navigation!.module, source.navigation!.id)}>
              前往{source.navigation.module === 'effects' ? '效果' : '特质'}：{source.navigation.id}
            </Button>}
          </Stack>
        </Paper>
      ))}
      {filtered.length > visibleCount && <Button variant="light" size="xs" onClick={() => setVisibleCount(v => v + 24)}>显示更多来源（已显示 {visibleCount} / {filtered.length}）</Button>}
      {groupedRefs.length > 0 && <>
        <Text size="xs" fw={600}>变量读写与运行时变化</Text>
        {groupedRefs.map((ref, i) => {
          const related = displayedRefs.filter(r => r.key === ref.key && r.scope === ref.scope && r.target === ref.target)
          const hasValue = ref.scope === 'buff' && entries.some(e => Object.values(e.binding.keys).includes(ref.key))
          const dynamic = related.some(r => r.access === 'write') || refs.some(r => r.scope === ref.scope && r.key === ref.key && r.access === 'write')
          return <Paper key={i} withBorder p="xs">
            <Group gap={4}><Badge size="xs" variant="outline">{SCOPE_NAMES[ref.scope]}</Badge><Badge size="xs" color={dynamic ? 'orange' : hasValue ? 'green' : 'gray'}>{dynamic ? '运行时变化' : hasValue ? '有来源记录' : '未找到静态来源'}</Badge></Group>
            <Text size="xs" ff="monospace" mt={4} style={{ overflowWrap: 'anywhere' }}>{ref.key}{ref.target ? ` · ${ref.target}` : ''}</Text>
            {related.map((r, j) => <Text key={j} size="10px" c="dimmed" title={r.path} style={{ overflowWrap: 'anywhere' }}>{r.detail}</Text>)}
          </Paper>
        })}
      </>}
      {links.length > 0 && <Accordion variant="separated"><Accordion.Item value="links"><Accordion.Control><Text size="xs">关联 Buff 与传参（{links.length}）</Text></Accordion.Control><Accordion.Panel><Stack gap="xs">
        {links.map((link, i) => <div key={i}><Button variant="subtle" size="compact-xs" disabled={!allTemplates[link.key]} onClick={() => goToDefinition(link.key)} style={{ maxWidth: '100%' }}>{link.key}</Button><Text size="10px" c="dimmed" style={{ overflowWrap: 'anywhere' }}>{link.evidence}</Text></div>)}
      </Stack></Accordion.Panel></Accordion.Item></Accordion>}
      {remote && <Text size="10px" c="dimmed" style={{ overflowWrap: 'anywhere' }}>GameData {remote.manifest.revision.slice(0, 12)} · 扫描 {remote.manifest.coverage.files} 个文件 / {remote.manifest.coverage.levels} 个关卡 · {remote.manifest.coverage.templates} 个模板有来源<br />{remote.manifest.dataVersion}</Text>}
    </Stack>
  )
  return <>
    <Stack gap="xs" style={{ height: '100%', overflow: 'hidden' }}>
      <Group justify="space-between"><Text size="xs" fw={600}>黑板值 · {filtered.length} 个来源</Text><Button aria-label="展开黑板完整视图" variant="subtle" size="compact-xs" onClick={() => setExpanded(true)}><IconMaximize size={14} /></Button></Group>
      {controls}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>{content(false)}</div>
    </Stack>
    <Modal opened={expanded} onClose={() => setExpanded(false)} title={`黑板值 · ${activeKey}`} size="xl">
      <Stack>{controls}{content(true)}</Stack>
    </Modal>
  </>
}
