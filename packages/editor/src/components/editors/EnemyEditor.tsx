import { useEffect, useRef, useState } from 'react'
import { ActionIcon, Badge, Button, Grid, Group, Modal, NavLink, Select, Stack, Text, TextInput, Title } from '@mantine/core'
import { IconPlus, IconSearch, IconTrash } from '@tabler/icons-react'
import { useDisclosure } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import type { SpecialEnemyInfoDict, TrSpecialEnemyTypeElement } from '@autochess-editor/shared'
import type { DataStore } from '../../store/dataStore'
import type { EnemyModule } from '../../store/enemyNavigation'
import { CNumberInput, CSelect, CSwitch, CTextInput, CollabEditingProvider } from '../collab/CollabInputs'
import { EditorSplitLayout, EditorListPane, EditorListScrollArea, EditorDetailPane } from '../shared/EditorLayout'
import { EnemyCard } from '../shared/EnemyCard'
import { getEnemyName, matchesEnemy } from '../shared/enemyNames'
import { useCollab } from '../../context/CollabContext'
import styles from './EnemyEditor.module.css'

interface Props { store: DataStore }
const ENEMY_TYPES: TrSpecialEnemyTypeElement[] = ['FLY', 'TIMES', 'ELEMENT', 'DOT', 'INVISIBLE', 'REFLECTION', 'SPECIAL']

export function EnemyEditor({ store, page }: Props & { page: EnemyModule }) {
  if (!store.activeSeason) return <Text c="dimmed">请先加载赛季数据</Text>
  switch (page) {
    case 'enemy:classification': return <EnemyInfoEditor store={store} />
    case 'enemy:special': return <SpecialEnemyEditor store={store} />
    case 'enemy:weights': return <EnemyWeightsEditor store={store} />
  }
}

function EnemyInfoEditor({ store }: Props) {
  const { activeSeason, activeSeasonId, updateSeason, focusId } = store
  const [selectedType, setSelectedType] = useState<TrSpecialEnemyTypeElement>('FLY')
  const [search, setSearch] = useState('')
  const { followingUserId, followTargetField } = useCollab()
  const [focusIndex, setFocusIndex] = useState<number | null>(null)
  const entriesRef = useRef<HTMLDivElement>(null)
  const type = ENEMY_TYPES.includes(focusId as TrSpecialEnemyTypeElement)
    ? focusId as TrSpecialEnemyTypeElement : selectedType
  const keys = activeSeason?.data.enemyInfoDict[type] ?? []
  const query = search.trim().toLowerCase()
  useEffect(() => { setSearch('') }, [focusId])
  useEffect(() => { if (followingUserId) setSearch('') }, [followingUserId, followTargetField])
  // Keep source indices: filtering must never redirect an edit or deletion.
  const matches = keys.map((key, index) => ({ key, index })).filter(entry => matchesEnemy(entry.key, query))

  useEffect(() => {
    if (focusIndex === null) return
    const input = entriesRef.current?.querySelector<HTMLInputElement>(`input[data-enemy-index="${focusIndex}"]`)
    input?.focus()
    input?.scrollIntoView({ block: 'nearest' })
    setFocusIndex(null)
  }, [focusIndex, keys.length])

  if (!activeSeason) return null
  function updateKeys(next: string[]) {
    updateSeason(activeSeasonId!, data => ({ ...data, enemyInfoDict: { ...data.enemyInfoDict, [type]: next } }))
  }
  function selectType(next: string) {
    if (!ENEMY_TYPES.includes(next as TrSpecialEnemyTypeElement)) return
    setSelectedType(next as TrSpecialEnemyTypeElement)
    setSearch('')
    store.navigateTo('enemy:classification', next)
  }
  function add() {
    setSearch('')
    setFocusIndex(keys.length)
    updateKeys([...keys, ''])
  }
  const categories = ENEMY_TYPES.map(value => ({ value, label: `${value} (${activeSeason.data.enemyInfoDict[value]?.length ?? 0})` }))
  return <div className={styles.classification}>
    <nav className={styles.categories} aria-label="敌人分类">
      <Text size="xs" c="dimmed" mb="xs">分类 / 数量</Text>
      {categories.map(category => <NavLink key={category.value} component="button" type="button"
        label={category.value} active={type === category.value} aria-current={type === category.value ? 'page' : undefined}
        rightSection={<Badge size="xs" variant="light">{activeSeason.data.enemyInfoDict[category.value]?.length ?? 0}</Badge>}
        onClick={() => selectType(category.value)} />)}
    </nav>
    <section className={styles.content} aria-label="分类敌人列表">
      <Select className={styles.mobileCategory} label="敌人分类" data={categories} value={type}
        allowDeselect={false} onChange={value => value && selectType(value)} />
      <Group justify="space-between" gap="xs">
        <Group gap="xs"><Title order={5}>{type}</Title><Badge variant="outline">{keys.length}</Badge></Group>
        <Button size="xs" variant="light" leftSection={<IconPlus size={12} />} onClick={add}>新增敌人</Button>
      </Group>
      <Text size="xs" c="dimmed">分类成员用于客户端敌人资源登记；FLY 也用于飞行属性的回退判断。列表按原始顺序保存。</Text>
      <Group gap="xs">
        <TextInput className={styles.search} size="xs" aria-label="搜索当前分类敌人" placeholder="搜索怪物名或敌人 ID…"
          leftSection={<IconSearch size={14} />} value={search} onChange={event => setSearch(event.currentTarget.value)} />
        <Text size="xs" c="dimmed">显示 {matches.length} / {keys.length}</Text>
      </Group>
      <div className={styles.entries} ref={entriesRef}>
        <CollabEditingProvider itemId={type}>
          <div className={styles.rows}>
            {matches.map(({ key, index }) => <EnemyCard key={index} enemyId={key}
              actions={<ActionIcon size="sm" variant="subtle" color="red" aria-label={`删除 ${type} 敌人 ${index + 1}`}
                onClick={() => updateKeys(keys.filter((_, position) => position !== index))}><IconTrash size={13} /></ActionIcon>}>
              <div className={styles.row}>
                <Text size="xs" c="dimmed" className={styles.index}>{index + 1}</Text>
                <CTextInput className={styles.input} size="xs" aria-label={`${type} 敌人 ${index + 1}`} title={key}
                  data-enemy-index={index} collabField={`enemy.${type}[${index}]`} value={key}
                  onChange={event => { const next = [...keys]; next[index] = event.currentTarget.value; updateKeys(next) }} />
              </div>
            </EnemyCard>)}
          </div>
        </CollabEditingProvider>
        {!matches.length && <Stack className={styles.empty} align="center" gap="xs">
          <Text size="sm" c="dimmed">{keys.length ? '没有匹配的敌人' : '当前分类还没有敌人'}</Text>
          <Button size="xs" variant="subtle" onClick={keys.length ? () => setSearch('') : add}>{keys.length ? '清空搜索' : '新增敌人'}</Button>
        </Stack>}
      </div>
    </section>
  </div>
}

function EnemyWeightsEditor({ store }: Props) {
  const { activeSeason, activeSeasonId, updateSeason } = store
  if (!activeSeason) return null
  const data = activeSeason.data
  return (
        <Stack gap="md">
          <Title order={5}>特殊敌人随机权重（specialEnemyRandomTypeDict）</Title>
          <Text size="sm" c="dimmed">类别层面的 count / weight，与特殊敌人条目的单体随机权重分别保存。配置会写入客户端赛季表；原生抽取的具体计算方式待运行验证。</Text>
          <Text size="sm" c="dimmed">服务器目前从固定六类中等概率选三类，并按代码规则生成初始回合类别，未读取这里的 count / weight。</Text>
          <Grid gutter="sm">
            {ENEMY_TYPES.map(type => {
              const val = data.specialEnemyRandomTypeDict[type]
              if (!val) return null
              return (
                <Grid.Col key={type} span={{ base: 12, sm: 6, lg: 4 }}>
                  <CollabEditingProvider itemId={`enemyRandom.${type}`}>
                  <Stack gap="xs">
                    <Text fw={600} size="sm">{type}</Text>
                    <CNumberInput
                      label="count（类别次数配置）"
                      collabField={`enemyRandom.${type}.count`}
                      value={val.count}
                      min={0}
                      onChange={v => updateSeason(activeSeasonId!, d => ({
                        ...d,
                        specialEnemyRandomTypeDict: {
                          ...d.specialEnemyRandomTypeDict,
                          [type]: { ...d.specialEnemyRandomTypeDict[type], count: Number(v) },
                        },
                      }))}
                    />
                    <CNumberInput
                      label="weight（类别权重）"
                      collabField={`enemyRandom.${type}.weight`}
                      value={val.weight}
                      min={0}
                      onChange={v => updateSeason(activeSeasonId!, d => ({
                        ...d,
                        specialEnemyRandomTypeDict: {
                          ...d.specialEnemyRandomTypeDict,
                          [type]: { ...d.specialEnemyRandomTypeDict[type], weight: Number(v) },
                        },
                      }))}
                    />
                  </Stack>
                  </CollabEditingProvider>
                </Grid.Col>
              )
            })}
          </Grid>
        </Stack>
  )
}

function SpecialEnemyEditor({ store }: Props) {
  const { activeSeason, activeSeasonId, updateSeason } = store
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const editingId = store.focusId && activeSeason?.data.specialEnemyInfoDict[store.focusId] ? store.focusId : selectedId
  function setEditingId(id: string | null) { setSelectedId(id); store.setFocusId(id) }
  const [addOpened, { open: openAdd, close: closeAdd }] = useDisclosure(false)
  const [newKey, setNewKey] = useState('')
  const [search, setSearch] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  if (!activeSeason) return null
  const { specialEnemyInfoDict } = activeSeason.data
  const all = Object.values(specialEnemyInfoDict).sort((a, b) => a.specialEnemyKey.localeCompare(b.specialEnemyKey))
  const list = all.filter(enemy => matchesEnemy(enemy.specialEnemyKey, search))
  const editing = editingId ? specialEnemyInfoDict[editingId] : null

  function patch(id: string, p: Partial<SpecialEnemyInfoDict>) {
    updateSeason(activeSeasonId!, d => ({
      ...d,
      specialEnemyInfoDict: { ...d.specialEnemyInfoDict, [id]: { ...d.specialEnemyInfoDict[id], ...p } },
    }))
  }

  function add() {
    const id = newKey.trim()
    if (!id) return
    if (specialEnemyInfoDict[id]) { notifications.show({ title: '已存在', message: `"${id}" 已存在`, color: 'red' }); return }
    updateSeason(activeSeasonId!, d => ({
      ...d,
      specialEnemyInfoDict: {
        ...d.specialEnemyInfoDict,
        [id]: { type: 'SPECIAL', specialEnemyKey: id, randomWeight: 100, isInFirstHalf: false, attachedNormalEnemyKeys: [], attachedEliteEnemyKeys: [] },
      },
    }))
    setEditingId(id); closeAdd(); setNewKey(''); setSearch('')
    notifications.show({ title: '已新增', message: `特殊敌人 ${id} 已创建`, color: 'teal' })
  }

  function del(id: string) {
    updateSeason(activeSeasonId!, d => { const n = { ...d.specialEnemyInfoDict }; delete n[id]; return { ...d, specialEnemyInfoDict: n } })
    if (editingId === id) setEditingId(null)
    setDeleteConfirm(null)
    notifications.show({ title: '已删除', message: `${id} 已删除`, color: 'orange' })
  }

  return (
    <>
      <EditorSplitLayout>
        <EditorListPane>

            <Group justify="space-between">
              <Title order={5}>特殊敌人列表</Title>
              <Group gap="xs">
                <Text size="xs" c="dimmed">{list.length} / {all.length}</Text>
                <Button size="xs" leftSection={<IconPlus size={12} />} variant="light" onClick={openAdd}>新增</Button>
              </Group>
            </Group>
            <TextInput size="xs" aria-label="搜索特殊敌人" placeholder="搜索怪物名或敌人 ID…" value={search}
              leftSection={<IconSearch size={14} />} onChange={event => setSearch(event.currentTarget.value)} />
            <EditorListScrollArea><Stack gap="xs">
              {list.map(enemy => <EnemyCard key={enemy.specialEnemyKey} enemyId={enemy.specialEnemyKey}
                selected={editingId === enemy.specialEnemyKey}
                onSelect={() => { setSelectedId(enemy.specialEnemyKey); store.navigateTo('enemy:special', enemy.specialEnemyKey) }}
                actions={<ActionIcon size="sm" variant="subtle" color="red" aria-label={`删除特殊敌人 ${enemy.specialEnemyKey}`}
                  onClick={() => setDeleteConfirm(enemy.specialEnemyKey)}><IconTrash size={12} /></ActionIcon>}
                details={<Group gap="xs"><Badge size="xs" color="orange">{enemy.type}</Badge>
                  <Text size="xs" c="dimmed">权重 {enemy.randomWeight} · {enemy.isInFirstHalf ? '前半场' : '后半场'}</Text></Group>} />)}
              {!list.length && <Text size="sm" c="dimmed" ta="center">{all.length ? '没有匹配的特殊敌人' : '还没有特殊敌人'}</Text>}
            </Stack></EditorListScrollArea>

        </EditorListPane>
        <EditorDetailPane>
          <CollabEditingProvider itemId={editingId}>
          {editing ? (
            <Stack gap="md">
              <Text size="sm" c="dimmed">条目配置会写入客户端赛季表，主敌人与附属敌人会加入资源登记。单体随机权重与类别权重分别保存；具体抽取行为待运行验证。</Text>
              <EnemyCard enemyId={editing.specialEnemyKey} />
              <Grid gutter="sm">
                <Grid.Col span={{ base: 12, sm: 6, lg: 4 }}>
                  <CSelect label="类型" value={editing.type}
                    data={ENEMY_TYPES.map(t => ({ value: t, label: t }))}
                    onChange={v => patch(editing.specialEnemyKey, { type: v as TrSpecialEnemyTypeElement })} />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6, lg: 4 }}>
                  <CNumberInput label="单体随机权重" value={editing.randomWeight} min={0}
                    onChange={v => patch(editing.specialEnemyKey, { randomWeight: Number(v) })} />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6, lg: 4 }}>
                  <CSwitch label="出现在前半场" checked={editing.isInFirstHalf} mt="xl"
                    onChange={e => patch(editing.specialEnemyKey, { isInFirstHalf: e.target.checked })} />
                </Grid.Col>
              </Grid>
              <EnemyKeyListField label="附加普通敌人" keys={editing.attachedNormalEnemyKeys}
                collabPrefix="normalEnemy"
                onChange={v => patch(editing.specialEnemyKey, { attachedNormalEnemyKeys: v })} />
              <EnemyKeyListField label="附加精英敌人" keys={editing.attachedEliteEnemyKeys}
                collabPrefix="eliteEnemy"
                onChange={v => patch(editing.specialEnemyKey, { attachedEliteEnemyKeys: v })} />
            </Stack>
          ) : <Text c="dimmed" ta="center" mt="xl">← 选择左侧条目</Text>}
          </CollabEditingProvider>
        </EditorDetailPane>
      </EditorSplitLayout>
      <Modal opened={addOpened} onClose={closeAdd} title="新增特殊敌人" size="sm">
        <Stack gap="md">
          <Text size="sm" c="dimmed">输入完整敌人 ID。{getEnemyName(newKey.trim()) ? `已识别：${getEnemyName(newKey.trim())}` : '未收录的自定义 ID 仍可创建。'}</Text>
          <CTextInput label="specialEnemyKey" value={newKey} onChange={e => setNewKey(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()} />
          <Group justify="flex-end"><Button variant="subtle" onClick={closeAdd}>取消</Button><Button onClick={add} disabled={!newKey.trim()}>创建</Button></Group>
        </Stack>
      </Modal>
      <Modal opened={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="确认删除" size="sm">
        <Stack gap="md">
          <Text>确定删除 <Text span fw={700} c="red">{deleteConfirm}</Text>？</Text>
          <Group justify="flex-end"><Button variant="subtle" onClick={() => setDeleteConfirm(null)}>取消</Button><Button color="red" onClick={() => deleteConfirm && del(deleteConfirm)}>删除</Button></Group>
        </Stack>
      </Modal>
    </>
  )
}

function EnemyKeyListField({ label, keys, collabPrefix, onChange }: {
  label: string; keys: string[]; collabPrefix: string; onChange: (keys: string[]) => void
}) {
  return <Stack gap="xs">
    <Text size="sm" fw={500}>{label}</Text>
    {keys.map((id, index) => <EnemyCard key={index} enemyId={id}
      actions={<ActionIcon size="sm" variant="subtle" color="red" aria-label={`删除${label} ${index + 1}`}
        onClick={() => onChange(keys.filter((_, position) => position !== index))}><IconTrash size={12} /></ActionIcon>}>
      <CTextInput size="xs" aria-label={`${label} ID ${index + 1}`} collabField={`${collabPrefix}[${index}]`} value={id}
        onChange={event => { const next = [...keys]; next[index] = event.currentTarget.value; onChange(next) }} />
    </EnemyCard>)}
    <Button size="xs" variant="subtle" w="fit-content" leftSection={<IconPlus size={12} />}
      onClick={() => onChange([...keys, ''])}>添加{label}</Button>
  </Stack>
}
