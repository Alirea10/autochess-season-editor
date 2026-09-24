import { EditorSplitLayout, EditorListPane, EditorListScrollArea, EditorDetailPane } from '../shared/EditorLayout'
import { Select } from '@mantine/core'
import { matchesSearch, matchesType, typeFilterOptions } from '../shared/listFilters'
import { SegmentedIdInput } from '../shared/SegmentedIdInput'
import { commitCreation } from '../shared/commitCreation'
import { useRevealEntry } from '../shared/useRevealEntry'
import { joinId, splitId, validateId, suggestGarrison, suggestGarrisonCopy } from '../shared/idNaming'
import { createGarrison, copyGarrisonEntry } from '../shared/creationActions'
import {
  Stack, Card, Group, Text, Badge, Grid, Title,
  ActionIcon, Divider,
  Table, Button, Modal,
} from '@mantine/core'
import { CTextInput, CNumberInput, CSelect, CTextarea, CMultiSelect, CollabEditingProvider } from '../collab/CollabInputs'
import { IconPlus, IconTrash, IconCopy } from '@tabler/icons-react'
import { useState, useMemo, useEffect } from 'react'
import { useDisclosure } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import { eventTypeLabel, getChessName } from '@autochess-editor/shared'
import { RichTextPreview } from '../shared/RichTextPreview'
import type { DataStore } from '../../store/dataStore'
import { PresenceIndicator } from '../collab/PresenceIndicator'
import { useCollab } from '../../context/CollabContext'
import type { GarrisonDataDict, EventType } from '@autochess-editor/shared'

interface Props { store: DataStore }

const DEFAULT_GARRISON: GarrisonDataDict = {
  garrisonDesc: '',
  eventType: 'IN_BATTLE',
  eventTypeDesc: '作战能力',
  eventTypeIcon: 'icon_battle',
  eventTypeSmallIcon: 's_icon_battle',
  effectType: '',
  charLevel: 1,
  battleRuneKey: null,
  blackboard: [],
  description: '',
}

export function GarrisonEditor({ store }: Props) {
  const { activeSeason, activeSeasonId, updateSeason, navigateTo, focusId, setFocusId } = store
  const { updatePresence } = useCollab()
  const [editingId, setEditingId] = useState<string | null>(null)

  useEffect(() => { updatePresence('garrison', editingId); return () => updatePresence('garrison', null) }, [editingId])
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string | null>(null)
  const [addOpened, { open: openAdd, close: closeAdd }] = useDisclosure(false)
  const [newGarrisonId, setNewGarrisonId] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [copySource, setCopySource] = useState<string | null>(null)
  const [copyTargetId, setCopyTargetId] = useState('')
  const { root: listRoot, reveal } = useRevealEntry()

  useEffect(() => {
    if (focusId && activeSeason?.data.garrisonDataDict && focusId in activeSeason.data.garrisonDataDict) {
      showEntry(focusId, activeSeason.data.garrisonDataDict[focusId])
      setFocusId(null)
    }
  }, [focusId, activeSeason, setFocusId])

  if (!activeSeason) return <Text c="dimmed">请先加载赛季数据</Text>

  const { garrisonDataDict, charChessDataDict, charShopChessDatas } = activeSeason.data

  // Build reverse map: garrisonId -> list of chessIds that use it
  const garrisonToChess = useMemo(() => {
    const m: Record<string, string[]> = {}
    for (const [chessId, chess] of Object.entries(charChessDataDict)) {
      if (chess.garrisonIds) {
        for (const gid of chess.garrisonIds) {
          if (!m[gid]) m[gid] = []
          m[gid].push(chessId)
        }
      }
    }
    return m
  }, [charChessDataDict])

  const garrisonList = useMemo(() =>
    Object.entries(garrisonDataDict).sort(([a], [b]) => a.localeCompare(b)),
    [garrisonDataDict]
  )
  const filterOptions = typeFilterOptions(Object.keys(eventTypeLabel), Object.values(garrisonDataDict).map(entry => entry.eventType), eventTypeLabel)
  const filtered = garrisonList.filter(([id, entry]) => matchesType(entry.eventType, typeFilter) && matchesSearch([id, entry.garrisonDesc, entry.eventTypeDesc, entry.eventType, eventTypeLabel[entry.eventType]], search))

  function showEntry(id: string, entry: GarrisonDataDict) {
    if (!matchesSearch([id, entry.garrisonDesc, entry.eventTypeDesc, entry.eventType, eventTypeLabel[entry.eventType]], search)) setSearch('')
    if (!matchesType(entry.eventType, typeFilter)) setTypeFilter(null)
    setEditingId(id); reveal(id)
  }

  const [editingKey, editingGarrison] = editingId
    ? ([editingId, garrisonDataDict[editingId]] as [string, GarrisonDataDict])
    : [null, null]

  const linkedChess = editingKey ? (garrisonToChess[editingKey] ?? []) : []

  function patchGarrison(id: string, patch: Partial<GarrisonDataDict>) {
    updateSeason(activeSeasonId!, data => ({
      ...data,
      garrisonDataDict: { ...data.garrisonDataDict, [id]: { ...data.garrisonDataDict[id], ...patch } },
    }))
  }

  function patchBlackboard(id: string, bbIdx: number, patch: Partial<{ key: string; value: number; valueStr: string | null }>) {
    updateSeason(activeSeasonId!, data => {
      const bb = [...data.garrisonDataDict[id].blackboard]
      bb[bbIdx] = { ...bb[bbIdx], ...patch }
      return { ...data, garrisonDataDict: { ...data.garrisonDataDict, [id]: { ...data.garrisonDataDict[id], blackboard: bb } } }
    })
  }

  function addBlackboardRow(id: string) {
    updateSeason(activeSeasonId!, data => {
      const bb = [...data.garrisonDataDict[id].blackboard, { key: 'new_key', value: 0, valueStr: null }]
      return { ...data, garrisonDataDict: { ...data.garrisonDataDict, [id]: { ...data.garrisonDataDict[id], blackboard: bb } } }
    })
  }

  function removeBlackboardRow(id: string, bbIdx: number) {
    updateSeason(activeSeasonId!, data => {
      const bb = data.garrisonDataDict[id].blackboard.filter((_, i) => i !== bbIdx)
      return { ...data, garrisonDataDict: { ...data.garrisonDataDict, [id]: { ...data.garrisonDataDict[id], blackboard: bb } } }
    })
  }

  /** 修改某个棋子绑定的 garrisonIds，同时更新 garrisonDataDict 无需手动维护反向关系 */
  function setChessGarrisons(chessId: string, garrisonIds: string[]) {
    updateSeason(activeSeasonId!, data => ({
      ...data,
      charChessDataDict: {
        ...data.charChessDataDict,
        [chessId]: { ...data.charChessDataDict[chessId], garrisonIds: garrisonIds.length > 0 ? garrisonIds : null },
      },
    }))
  }

  const finalNewId = joinId(splitId(newGarrisonId))
  const finalCopyId = joinId(splitId(copyTargetId))
  const newIdError = validateId(finalNewId, Object.keys(garrisonDataDict))
  const copyIdError = validateId(finalCopyId, Object.keys(garrisonDataDict))
  function openCreate() {
    setNewGarrisonId(suggestGarrison(Object.keys(garrisonDataDict))); openAdd()
  }
  function addGarrison() {
    const id = finalNewId
    if (!commitCreation(store, data => createGarrison(data, id, DEFAULT_GARRISON))) return
    const created = store.getSeason(activeSeasonId!)!.data.garrisonDataDict[id]
    showEntry(id, created); closeAdd(); setNewGarrisonId('')
    notifications.show({ title: '已新增', message: `特质 ${id} 已创建`, color: 'teal' })
  }

  function deleteGarrison(id: string) {
    updateSeason(activeSeasonId!, data => {
      const next = { ...data.garrisonDataDict }
      delete next[id]
      return { ...data, garrisonDataDict: next }
    })
    if (editingId === id) setEditingId(null)
    setDeleteConfirm(null)
    notifications.show({ title: '已删除', message: `特质 ${id} 已删除`, color: 'orange' })
  }

  function copyGarrison() {
    const source = copySource!
    const id = finalCopyId
    if (!commitCreation(store, data => copyGarrisonEntry(data, source, id))) return
    const created = store.getSeason(activeSeasonId!)!.data.garrisonDataDict[id]
    showEntry(id, created); setCopySource(null); setCopyTargetId('')
    notifications.show({ title: '已复制', message: `特质 ${id} 已从 ${source} 复制创建`, color: 'teal' })
  }

  const allChessOptions = useMemo(() => {
    const lookup = activeSeason.data.chessNormalIdLookupDict ?? {}
    const entries: { value: string; label: string }[] = []
    for (const [chessId, shopData] of Object.entries(charShopChessDatas)) {
      const name = getChessName(chessId, charShopChessDatas, lookup)
      entries.push({ value: chessId, label: `${name} 普通 (${chessId})` })
      const goldenId = shopData.goldenChessId
      if (goldenId) {
        entries.push({ value: goldenId, label: `${name} 进阶 (${goldenId})` })
      }
    }
    return entries.sort((a, b) => a.label.localeCompare(b.label))
  }, [charShopChessDatas, activeSeason.data.chessNormalIdLookupDict])

  const eventTypeOptions = [
    'IN_BATTLE', 'SERVER_PRICE', 'SERVER_CHESS_SOLD', 'SERVER_GAIN',
    'SERVER_PREP_FIN', 'SERVER_PREP_START', 'SERVER_REFRESH_SHOP',
  ].map(v => ({ value: v, label: `${eventTypeLabel[v] ?? v} (${v})` }))

  return (
    <>
      <EditorSplitLayout>
        <EditorListPane>

            <Group justify="space-between">
              <Title order={5}>干员特质列表</Title>
              <Group gap="xs">
                <Text size="xs" c="dimmed">{filtered.length}/{garrisonList.length}</Text>
                <Button size="xs" leftSection={<IconPlus size={12} />} variant="light" onClick={openCreate}>
                  新增
                </Button>
              </Group>
            </Group>
            <CTextInput
              placeholder="搜索特质描述或 ID..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              size="xs"
            />
            <Select size="xs" label="触发时机" placeholder="全部" searchable clearable
              value={typeFilter} onChange={setTypeFilter} data={filterOptions} />
            {editingGarrison && editingId && !filtered.some(([id]) => id === editingId) && <Group gap="xs">
              <Text size="xs" c="orange">当前条目不在筛选结果中</Text>
              <Button size="compact-xs" variant="subtle" onClick={() => showEntry(editingId, editingGarrison)}>定位当前条目</Button>
            </Group>}
            {!filtered.length && <Text size="sm" c="dimmed">没有符合筛选条件的条目</Text>}
            <EditorListScrollArea ref={listRoot}>
              <Stack gap="xs">
                {filtered.map(([id, g]) => (
                  <Card
                    key={id}
                    data-entry-id={id}
                    padding="sm"
                    radius="md"
                    withBorder
                    style={{ cursor: 'pointer', borderColor: editingId === id ? 'var(--mantine-color-teal-6)' : undefined }}
                    onClick={() => setEditingId(id)}
                  >
                    <Group justify="space-between" wrap="nowrap">
                      <div style={{ minWidth: 0 }}>
                        <Group gap="xs" mb={2}>
                          <Badge size="xs" color="blue" variant="light">{g.eventTypeDesc}</Badge>
                          <PresenceIndicator itemId={id} />
                          <Badge size="xs" color="gray" variant="outline">Lv.{g.charLevel}</Badge>
                          {garrisonToChess[id]?.length > 0 && (
                            <Badge size="xs" color="teal">{garrisonToChess[id].length}人</Badge>
                          )}
                        </Group>
                        <RichTextPreview text={g.garrisonDesc || id} maxLen={50} />
                      </div>
                      <Group gap={4} wrap="nowrap">
                        <ActionIcon
                          size="sm" variant="subtle" color="blue" aria-label={`复制特质 ${id}`}
                          onClick={e => { e.stopPropagation(); setCopySource(id); setCopyTargetId(suggestGarrisonCopy(id, Object.keys(garrisonDataDict))) }}
                        >
                          <IconCopy size={12} />
                        </ActionIcon>
                        <ActionIcon
                          size="sm" variant="subtle" color="red"
                          onClick={e => { e.stopPropagation(); setDeleteConfirm(id) }}
                        >
                          <IconTrash size={12} />
                        </ActionIcon>
                      </Group>
                    </Group>
                  </Card>
                ))}
              </Stack>
            </EditorListScrollArea>

        </EditorListPane>

        <EditorDetailPane>
          {editingGarrison && editingKey ? (
            <CollabEditingProvider itemId={editingId}>
            <Stack gap="md">
              <Group justify="space-between">
                <Title order={5}>编辑干员特质</Title>
                <Text size="xs" c="dimmed" ff="monospace">{editingKey}</Text>
              </Group>

              <Grid gutter="sm">
                <Grid.Col span={6}>
                  <CSelect
                    label="触发时机"
                    value={editingGarrison.eventType}
                    data={eventTypeOptions}
                    onChange={v => patchGarrison(editingKey, { eventType: v as EventType })}
                  />
                </Grid.Col>
                <Grid.Col span={3}>
                  <CNumberInput
                    label="触发等级"
                    value={editingGarrison.charLevel}
                    min={0}
                    onChange={v => patchGarrison(editingKey, { charLevel: Number(v) })}
                  />
                </Grid.Col>
                <Grid.Col span={3}>
                  <CTextInput
                    label="时机描述"
                    value={editingGarrison.eventTypeDesc}
                    onChange={e => patchGarrison(editingKey, { eventTypeDesc: e.target.value as any })}
                  />
                </Grid.Col>
                <Grid.Col span={12}>
                  <CTextarea
                    label="特质描述（富文本）"
                    value={editingGarrison.garrisonDesc}
                    autosize
                    minRows={3}
                    onChange={e => patchGarrison(editingKey, { garrisonDesc: e.target.value })}
                  />
                </Grid.Col>
                <Grid.Col span={12}>
                  <CTextarea
                    label="普通描述"
                    value={editingGarrison.description}
                    autosize
                    minRows={2}
                    onChange={e => patchGarrison(editingKey, { description: e.target.value })}
                  />
                </Grid.Col>
                <Grid.Col span={6}>
                  <CTextInput
                    label="效果类型"
                    value={editingGarrison.effectType}
                    onChange={e => patchGarrison(editingKey, { effectType: e.target.value })}
                  />
                </Grid.Col>
                <Grid.Col span={6}>
                  <CTextInput
                    label="战斗符文 Key"
                    value={editingGarrison.battleRuneKey ?? ''}
                    placeholder="（无）"
                    onChange={e => patchGarrison(editingKey, { battleRuneKey: e.target.value as any || null })}
                  />
                </Grid.Col>
              </Grid>

              <Divider label="描述预览" labelPosition="left" />
              <Card withBorder padding="sm">
                <RichTextPreview text={editingGarrison.garrisonDesc} maxLen={300} />
              </Card>

              <Divider
                label={
                  <Group gap="xs">
                    <Text size="xs">Blackboard 数值（{editingGarrison.blackboard.length} 行）</Text>
                    <ActionIcon size="xs" variant="light" color="teal" onClick={() => addBlackboardRow(editingKey)}>
                      <IconPlus size={10} />
                    </ActionIcon>
                  </Group>
                }
                labelPosition="left"
              />
              {editingGarrison.blackboard.length === 0
                ? <Text size="xs" c="dimmed">暂无数值行</Text>
                : (
                  <Table fz="xs" withTableBorder>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Key</Table.Th>
                        <Table.Th>Value</Table.Th>
                        <Table.Th>ValueStr</Table.Th>
                        <Table.Th w={30}></Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {editingGarrison.blackboard.map((bb, i) => (
                        <Table.Tr key={i}>
                          <Table.Td>
                            <CTextInput size="xs" collabField={`bb[${i}].key`} value={bb.key} w={140}
                              onChange={e => patchBlackboard(editingKey, i, { key: e.target.value })} />
                          </Table.Td>
                          <Table.Td>
                            <CNumberInput size="xs" collabField={`bb[${i}].value`} value={bb.value} step={0.01} decimalScale={4} w={100}
                              onChange={v => patchBlackboard(editingKey, i, { value: Number(v) })} />
                          </Table.Td>
                          <Table.Td>
                            <CTextInput size="xs" collabField={`bb[${i}].valueStr`} value={bb.valueStr ?? ''} placeholder="null" w={100}
                              onChange={e => patchBlackboard(editingKey, i, { valueStr: e.target.value || null })} />
                          </Table.Td>
                          <Table.Td>
                            <ActionIcon size="xs" variant="subtle" color="red"
                              onClick={() => removeBlackboardRow(editingKey, i)}>
                              <IconTrash size={10} />
                            </ActionIcon>
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                )
              }

              <Divider label={`拥有此特质的干员（${linkedChess.length} 人）`} labelPosition="left" />
              <CMultiSelect
                placeholder="选择棋子..."
                searchable
                value={linkedChess}
                data={allChessOptions}
                onChange={selectedChessIds => {
                  const removed = linkedChess.filter(id => !selectedChessIds.includes(id))
                  const added = selectedChessIds.filter(id => !linkedChess.includes(id))
                  removed.forEach(chessId => {
                    const cur = charChessDataDict[chessId]?.garrisonIds ?? []
                    setChessGarrisons(chessId, cur.filter(g => g !== editingKey))
                  })
                  added.forEach(chessId => {
                    const cur = charChessDataDict[chessId]?.garrisonIds ?? []
                    if (!cur.includes(editingKey)) setChessGarrisons(chessId, [...cur, editingKey])
                  })
                }}
                maxDropdownHeight={200}
              />
              <Group gap="xs" wrap="wrap">
                {linkedChess.map(chessId => {
                  const normalId = activeSeason.data.chessNormalIdLookupDict?.[chessId] ?? chessId
                  return (
                    <Badge key={chessId} variant="light" color="teal" size="sm" style={{ cursor: 'pointer' }}
                      onClick={() => navigateTo('chess', normalId)}>
                      {getChessName(chessId, charShopChessDatas, activeSeason.data.chessNormalIdLookupDict)} ↗
                    </Badge>
                  )
                })}
              </Group>
            </Stack>
            </CollabEditingProvider>
          ) : (
            <Card withBorder padding="xl" ta="center">
              <Text c="dimmed">← 选择左侧特质进行编辑</Text>
            </Card>
          )}
        </EditorDetailPane>
      </EditorSplitLayout>

      {/* 新增特质 Modal */}
      <Modal opened={addOpened} onClose={closeAdd} title="新增干员特质" size="lg">
        <Stack gap="md">
          <SegmentedIdInput label="特质 ID" value={newGarrisonId} onChange={setNewGarrisonId}
            error={newIdError} onSubmit={addGarrison} />
          <Button size="compact-xs" variant="subtle" onClick={() => setNewGarrisonId(suggestGarrison(Object.keys(garrisonDataDict)))}>重新建议编号</Button>
          <Group justify="flex-end">
            <Button variant="subtle" onClick={closeAdd}>取消</Button>
            <Button onClick={addGarrison} disabled={!!newIdError}>创建</Button>
          </Group>
        </Stack>
      </Modal>

      {/* 删除确认 Modal */}
      <Modal
        opened={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="确认删除"
        size="sm"
      >
        <Stack gap="md">
          <Text>确定要删除特质 <Text span fw={700} c="red">{deleteConfirm}</Text> 吗？</Text>
          <Text size="sm" c="dimmed">此操作不可撤销。请确认已从所有关联干员中移除该特质。</Text>
          <Group justify="flex-end">
            <Button variant="subtle" onClick={() => setDeleteConfirm(null)}>取消</Button>
            <Button color="red" onClick={() => deleteConfirm && deleteGarrison(deleteConfirm)}>删除</Button>
          </Group>
        </Stack>
      </Modal>

      {/* 复制 Modal */}
      <Modal
        opened={!!copySource}
        onClose={() => setCopySource(null)}
        title={`复制特质：${copySource}`}
        size="lg"
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed">将复制 <Text span fw={600} c="blue">{copySource}</Text> 的配置和 Blackboard 到新特质，保留触发等级等设置；清空特质描述与说明，不复制棋子关联。</Text>
          <SegmentedIdInput key={copySource} label="新特质 ID" value={copyTargetId} onChange={setCopyTargetId}
            error={copyIdError} selectLast onSubmit={copyGarrison} />
          <Group justify="flex-end">
            <Button variant="subtle" onClick={() => setCopySource(null)}>取消</Button>
            <Button onClick={copyGarrison} disabled={!!copyIdError}>复制创建</Button>
          </Group>
        </Stack>
      </Modal>
    </>
  )
}
