import { KeyListField } from '../shared/KeyListField'
import { hasSplitEditor, EditorSplitLayout, EditorListPane, EditorListScrollArea, EditorDetailPane } from '../shared/EditorLayout'
import type { MiscPanel } from '../../store/miscNavigation'
import { SeasonDiagnosticsEditor } from './SeasonDiagnosticsEditor'
import { BondClassificationManager } from './BondClassificationEditor'
import { inspectBondClassification, resolveLegacyBanConfig } from '@autochess-editor/shared'
import { EconomyEditor } from './EconomyEditor'
import { ClientResourcesEditor } from './RuntimeEditors'
import {
  Stack, Group, Text, Grid,
  ActionIcon, Title, Divider,
  Button, Modal, Table, Tabs, Badge,
} from '@mantine/core'
import {
  CNumberInput, CTextInput, CSelect, CTextarea, CMultiSelect, CSwitch,
  CollabEditingProvider,
} from '../collab/CollabInputs'
import { IconPlus, IconTrash } from '@tabler/icons-react'
import { useState } from 'react'
import { useDisclosure } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import type {
  BandDataListDict, StageDatasDict, TrainingNpcList,
  MilestoneList, ItemType, ChoiceType, EffectType, BanConfig,
} from '@autochess-editor/shared'
import { getCharName } from '@autochess-editor/shared'
import type { DataStore } from '../../store/dataStore'

interface Props { store: DataStore }

export function MiscEditor({ store, page }: Props & { page: MiscPanel }) {
  const { activeSeason } = store

  if (!activeSeason) return <Text c="dimmed">请先加载赛季数据</Text>

  return (
    <Tabs value={page} keepMounted={false} h={hasSplitEditor(`misc:${page}`) ? '100%' : undefined} styles={hasSplitEditor(`misc:${page}`) ? { panel: { height: '100%', minHeight: 0 } } : undefined}>
      <Tabs.Panel value="diagnostics"><SeasonDiagnosticsEditor store={store} /></Tabs.Panel>
      <Tabs.Panel value="economy"><EconomyEditor store={store} /></Tabs.Panel>
      <Tabs.Panel value="clientResources"><ClientResourcesEditor store={store} /></Tabs.Panel>

      {/* ── 策略组 bandDataListDict ── */}
      <Tabs.Panel value="band">
        <BandEditor store={store} />
      </Tabs.Panel>

      {/* ── 关卡 stageDatasDict ── */}
      <Tabs.Panel value="stage">
        <StageEditor store={store} />
      </Tabs.Panel>

      {/* ── 战斗模板 battleDataDict ── */}
      <Tabs.Panel value="battle">
        <BattleDataEditor store={store} />
      </Tabs.Panel>

      {/* ── 训练 NPC ── */}
      <Tabs.Panel value="trainingNpc">
        <TrainingNpcEditor store={store} />
      </Tabs.Panel>

      {/* ── 里程碑 ── */}
      <Tabs.Panel value="milestone">
        <MilestoneEditor store={store} />
      </Tabs.Panel>

      {/* ── 玩家称号 playerTitleDataDict ── */}
      <Tabs.Panel value="playerTitle">
        <PlayerTitleEditor store={store} />
      </Tabs.Panel>

      {/* ── 常量 constData ── */}
      <Tabs.Panel value="constData">
        <ConstDataEditor store={store} />
      </Tabs.Panel>

      <Tabs.Panel value="banConfig">
        <BanConfigEditor store={store} />
      </Tabs.Panel>

      {/* ── DIY 棋子 diyChessDict ── */}
      <Tabs.Panel value="diy">
        <DiyChessEditor store={store} />
      </Tabs.Panel>

      {/* ── 效果选项 effectChoiceInfoDict ── */}
      <Tabs.Panel value="effectChoice">
        <EffectChoiceEditor store={store} />
      </Tabs.Panel>
    </Tabs>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// BandEditor: bandDataListDict
// ─────────────────────────────────────────────────────────────────────────────
function BandEditor({ store }: Props) {
  const { activeSeason, activeSeasonId, updateSeason } = store
  const [editingId, setEditingId] = useState<string | null>(null)
  const [addOpened, { open: openAdd, close: closeAdd }] = useDisclosure(false)
  const [newId, setNewId] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  if (!activeSeason) return null
  const { bandDataListDict, effectInfoDataDict } = activeSeason.data
  const list = Object.values(bandDataListDict).sort((a, b) => a.sortId - b.sortId)
  const editing = editingId ? bandDataListDict[editingId] : null

  function patch(id: string, p: Partial<BandDataListDict>) {
    updateSeason(activeSeasonId!, d => ({
      ...d,
      bandDataListDict: { ...d.bandDataListDict, [id]: { ...d.bandDataListDict[id], ...p } },
    }))
  }

  function add() {
    const id = newId.trim()
    if (!id) return
    if (bandDataListDict[id]) { notifications.show({ title: '已存在', message: `"${id}" 已存在`, color: 'red' }); return }
    const nextSort = Math.max(...list.map(b => b.sortId), -1) + 1
    updateSeason(activeSeasonId!, d => ({
      ...d,
      bandDataListDict: {
        ...d.bandDataListDict,
        [id]: {
            bandId: id,
            sortId: nextSort,
            modeTypeList: [
                "SINGLE",
                "MULTI"
            ],
            bandDesc: '',
            totalHp: 20,
            effectId: '',
            victorCount: 3,
            bandRewardModulus: 1,
            updateTime: 1773475200
        },
      },
    }))
    setEditingId(id); closeAdd(); setNewId('')
    notifications.show({ title: '已新增', message: `策略组 ${id} 已创建`, color: 'teal' })
  }

  function del(id: string) {
    updateSeason(activeSeasonId!, d => { const n = { ...d.bandDataListDict }; delete n[id]; return { ...d, bandDataListDict: n } })
    if (editingId === id) setEditingId(null)
    setDeleteConfirm(null)
  }

  const effectOptions = [
    { value: '', label: '（无）' },
    ...Object.entries(effectInfoDataDict).map(([id, e]) => ({ value: id, label: e.effectName || id })),
  ]

  const modeTypeOptions = [
    { value: 'LOCAL', label: '本地 (LOCAL)' },
    { value: 'SINGLE', label: '单人 (SINGLE)' },
    { value: 'MULTI', label: '多人 (MULTI)' },
  ]

  return (
    <>
      <EditorSplitLayout>
        <EditorListPane>

            <Group justify="space-between">
              <Title order={5}>策略组列表</Title>
              <Group gap="xs">
                <Text size="xs" c="dimmed">{list.length}</Text>
                <Button size="xs" leftSection={<IconPlus size={12} />} variant="light" onClick={openAdd}>新增</Button>
              </Group>
            </Group>
            <EditorListScrollArea><Stack gap="xs">
              {list.map(b => (
                <Group key={b.bandId} justify="space-between" wrap="nowrap"
                  style={{ cursor: 'pointer', padding: '6px 8px', borderRadius: 6, border: `1px solid ${editingId === b.bandId ? 'var(--mantine-color-teal-6)' : 'var(--mantine-color-dark-4)'}` }}
                  onClick={() => setEditingId(b.bandId)}>
                  <div>
                    <Text size="sm" ff="monospace">{b.bandId}</Text>
                    <Text size="xs" c="dimmed">HP {b.totalHp} · 胜 {b.victorCount}</Text>
                  </div>
                  <ActionIcon size="sm" variant="subtle" color="red"
                    onClick={ev => { ev.stopPropagation(); setDeleteConfirm(b.bandId) }}>
                    <IconTrash size={12} />
                  </ActionIcon>
                </Group>
              ))}
            </Stack></EditorListScrollArea>

        </EditorListPane>
        <EditorDetailPane>
          <CollabEditingProvider itemId={editingId}>
          {editing ? (
            <Stack gap="md">
              <Text ff="monospace" size="sm" c="dimmed">{editing.bandId}</Text>
              <Grid gutter="sm">
                <Grid.Col span={4}>
                  <CNumberInput label="总 HP" value={editing.totalHp} min={0}
                    onChange={v => patch(editing.bandId, { totalHp: Number(v) })} />
                </Grid.Col>
                <Grid.Col span={4}>
                  <CNumberInput label="胜利场数" value={editing.victorCount} min={0}
                    onChange={v => patch(editing.bandId, { victorCount: Number(v) })} />
                </Grid.Col>
                <Grid.Col span={4}>
                  <CNumberInput label="奖励倍率" value={editing.bandRewardModulus} step={0.1} decimalScale={2}
                    onChange={v => patch(editing.bandId, { bandRewardModulus: Number(v) })} />
                </Grid.Col>
                <Grid.Col span={4}>
                  <CNumberInput label="排序 ID" value={editing.sortId}
                    onChange={v => patch(editing.bandId, { sortId: Number(v) })} />
                </Grid.Col>
                {editing.updateTime !== undefined && (
                  <Grid.Col span={4}>
                    <CNumberInput label="更新时间戳" value={editing.updateTime}
                      onChange={v => patch(editing.bandId, { updateTime: Number(v) })} />
                  </Grid.Col>
                )}
                <Grid.Col span={12}>
                  <CTextarea label="策略描述" value={editing.bandDesc} autosize minRows={2}
                    onChange={e => patch(editing.bandId, { bandDesc: e.target.value })} />
                </Grid.Col>
                <Grid.Col span={6}>
                  <CSelect label="关联效果" value={editing.effectId || ''} data={effectOptions} searchable
                    onChange={v => patch(editing.bandId, { effectId: v || '' })} />
                </Grid.Col>
                <Grid.Col span={6}>
                  <CMultiSelect label="适用模式类型" value={editing.modeTypeList} data={modeTypeOptions}
                    onChange={v => patch(editing.bandId, { modeTypeList: v as any[] })} />
                </Grid.Col>
              </Grid>
            </Stack>
          ) : <Text c="dimmed" ta="center" mt="xl">← 选择左侧条目</Text>}
          </CollabEditingProvider>
        </EditorDetailPane>
      </EditorSplitLayout>
      <Modal opened={addOpened} onClose={closeAdd} title="新增策略组" size="sm">
        <Stack gap="md">
          <CTextInput label="bandId" value={newId} onChange={e => setNewId(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()} />
          <Group justify="flex-end"><Button variant="subtle" onClick={closeAdd}>取消</Button><Button onClick={add} disabled={!newId.trim()}>创建</Button></Group>
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

// ─────────────────────────────────────────────────────────────────────────────
// StageEditor: stageDatasDict
// ─────────────────────────────────────────────────────────────────────────────
function StageEditor({ store }: Props) {
  const { activeSeason, activeSeasonId, updateSeason } = store
  const [editingId, setEditingId] = useState<string | null>(null)
  const [addOpened, { open: openAdd, close: closeAdd }] = useDisclosure(false)
  const [newId, setNewId] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  if (!activeSeason) return null
  const { stageDatasDict, modeDataDict } = activeSeason.data
  const list = Object.values(stageDatasDict).sort((a, b) => a.stageId.localeCompare(b.stageId))
  const editing = editingId ? stageDatasDict[editingId] : null

  function patch(id: string, p: Partial<StageDatasDict>) {
    updateSeason(activeSeasonId!, d => ({
      ...d,
      stageDatasDict: { ...d.stageDatasDict, [id]: { ...d.stageDatasDict[id], ...p } },
    }))
  }

  function add() {
    const id = newId.trim()
    if (!id) return
    if (stageDatasDict[id]) { notifications.show({ title: '已存在', message: `"${id}" 已存在`, color: 'red' }); return }
    updateSeason(activeSeasonId!, d => ({
      ...d,
      stageDatasDict: { ...d.stageDatasDict, [id]: { stageId: id, mode: [], weight: 100 } },
    }))
    setEditingId(id); closeAdd(); setNewId('')
    notifications.show({ title: '已新增', message: `关卡 ${id} 已创建`, color: 'teal' })
  }

  function del(id: string) {
    updateSeason(activeSeasonId!, d => { const n = { ...d.stageDatasDict }; delete n[id]; return { ...d, stageDatasDict: n } })
    if (editingId === id) setEditingId(null)
    setDeleteConfirm(null)
  }

  const modeOptions = Object.keys(modeDataDict).map(id => ({ value: id, label: id }))

  return (
    <>
      <EditorSplitLayout>
        <EditorListPane>

            <Group justify="space-between">
              <Title order={5}>关卡列表</Title>
              <Group gap="xs">
                <Text size="xs" c="dimmed">{list.length}</Text>
                <Button size="xs" leftSection={<IconPlus size={12} />} variant="light" onClick={openAdd}>新增</Button>
              </Group>
            </Group>
            <EditorListScrollArea><Stack gap="xs">
              {list.map(s => (
                <Group key={s.stageId} justify="space-between" wrap="nowrap"
                  style={{ cursor: 'pointer', padding: '6px 8px', borderRadius: 6, border: `1px solid ${editingId === s.stageId ? 'var(--mantine-color-teal-6)' : 'var(--mantine-color-dark-4)'}` }}
                  onClick={() => setEditingId(s.stageId)}>
                  <div>
                    <Text size="sm" ff="monospace">{s.stageId}</Text>
                    <Text size="xs" c="dimmed">权重 {s.weight} · 模式 {s.mode.join(', ') || '—'}</Text>
                  </div>
                  <ActionIcon size="sm" variant="subtle" color="red"
                    onClick={ev => { ev.stopPropagation(); setDeleteConfirm(s.stageId) }}>
                    <IconTrash size={12} />
                  </ActionIcon>
                </Group>
              ))}
            </Stack></EditorListScrollArea>

        </EditorListPane>
        <EditorDetailPane>
          <CollabEditingProvider itemId={editingId}>
          {editing ? (
            <Stack gap="md">
              <Text ff="monospace" size="sm" c="dimmed">{editing.stageId}</Text>
              <Grid gutter="sm">
                <Grid.Col span={4}>
                  <CNumberInput label="权重" value={editing.weight} min={0}
                    onChange={v => patch(editing.stageId, { weight: Number(v) })} />
                </Grid.Col>
                <Grid.Col span={12}>
                  <CMultiSelect label="适用模式" value={editing.mode} data={modeOptions} searchable
                    onChange={v => patch(editing.stageId, { mode: v })} />
                </Grid.Col>
              </Grid>
            </Stack>
          ) : <Text c="dimmed" ta="center" mt="xl">← 选择左侧条目</Text>}
          </CollabEditingProvider>
        </EditorDetailPane>
      </EditorSplitLayout>
      <Modal opened={addOpened} onClose={closeAdd} title="新增关卡" size="sm">
        <Stack gap="md">
          <CTextInput label="stageId" value={newId} onChange={e => setNewId(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()} />
          <Group justify="flex-end"><Button variant="subtle" onClick={closeAdd}>取消</Button><Button onClick={add} disabled={!newId.trim()}>创建</Button></Group>
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

// ─────────────────────────────────────────────────────────────────────────────
// BattleDataEditor: battleDataDict
// 结构：{ [mode]: { [diffOrKey]: ModeMultiFunnyElement[] } }
// ─────────────────────────────────────────────────────────────────────────────
function BattleDataEditor({ store }: Props) {
  const { activeSeason, activeSeasonId, updateSeason } = store
  if (!activeSeason) return null
  const { battleDataDict } = activeSeason.data
  const modes = Object.keys(battleDataDict)

  return (
    <Stack gap="md">
      <Title order={5}>战斗模板配置（battleDataDict）</Title>
      <Text size="sm" c="dimmed">结构：mode → difficulty → 关卡列表。点击条目可编辑 bossId 和 levelId。</Text>
      {modes.map(mode => (
        <Stack key={mode} gap="xs">
          <Divider label={<Text fw={600} size="sm">{mode}</Text>} labelPosition="left" />
          {Object.entries(battleDataDict[mode]).map(([diff, entries]) => (
            <Stack key={diff} gap="xs" ml="md">
              <Group justify="space-between">
                <Text size="sm" c="dimmed">{diff} ({entries.length} 条)</Text>
                <ActionIcon size="xs" variant="light" color="teal" onClick={() => {
                  updateSeason(activeSeasonId!, d => ({
                    ...d,
                    battleDataDict: {
                      ...d.battleDataDict,
                      [mode]: {
                        ...d.battleDataDict[mode],
                        [diff]: [...(d.battleDataDict[mode][diff] ?? []), { bossId: null, levelId: '', isSpPrepare: false }],
                      },
                    },
                  }))
                }}>
                  <IconPlus size={10} />
                </ActionIcon>
              </Group>
              <Table fz="xs" withTableBorder>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>#</Table.Th>
                    <Table.Th>levelId</Table.Th>
                    <Table.Th>bossId</Table.Th>
                    <Table.Th>isSpPrepare</Table.Th>
                    <Table.Th w={30}></Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {entries.map((entry, i) => (
                    <Table.Tr key={i}>
                      <Table.Td>{i + 1}</Table.Td>
                      <Table.Td>
                        <CTextInput size="xs" collabField={`battle.${mode}.${diff}[${i}].levelId`} value={entry.levelId} w={180}
                          onChange={e => {
                            updateSeason(activeSeasonId!, d => {
                              const arr = [...d.battleDataDict[mode][diff]]
                              arr[i] = { ...arr[i], levelId: e.target.value }
                              return { ...d, battleDataDict: { ...d.battleDataDict, [mode]: { ...d.battleDataDict[mode], [diff]: arr } } }
                            })
                          }} />
                      </Table.Td>
                      <Table.Td>
                        <CTextInput size="xs" collabField={`battle.${mode}.${diff}[${i}].bossId`} value={entry.bossId ?? ''} placeholder="null" w={140}
                          onChange={e => {
                            updateSeason(activeSeasonId!, d => {
                              const arr = [...d.battleDataDict[mode][diff]]
                              arr[i] = { ...arr[i], bossId: e.target.value || null }
                              return { ...d, battleDataDict: { ...d.battleDataDict, [mode]: { ...d.battleDataDict[mode], [diff]: arr } } }
                            })
                          }} />
                      </Table.Td>
                      <Table.Td>
                        <CSwitch checked={entry.isSpPrepare} onChange={ev => {
                          updateSeason(activeSeasonId!, d => {
                            const arr = [...d.battleDataDict[mode][diff]]
                            arr[i] = { ...arr[i], isSpPrepare: ev.target.checked }
                            return { ...d, battleDataDict: { ...d.battleDataDict, [mode]: { ...d.battleDataDict[mode], [diff]: arr } } }
                          })
                        }} />
                      </Table.Td>
                      <Table.Td>
                        <ActionIcon size="xs" variant="subtle" color="red" onClick={() => {
                          updateSeason(activeSeasonId!, d => {
                            const arr = d.battleDataDict[mode][diff].filter((_, j) => j !== i)
                            return { ...d, battleDataDict: { ...d.battleDataDict, [mode]: { ...d.battleDataDict[mode], [diff]: arr } } }
                          })
                        }}>
                          <IconTrash size={10} />
                        </ActionIcon>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Stack>
          ))}
        </Stack>
      ))}
    </Stack>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TrainingNpcEditor: trainingNpcList
// ─────────────────────────────────────────────────────────────────────────────
function TrainingNpcEditor({ store }: Props) {
  const { activeSeason, activeSeasonId, updateSeason } = store
  if (!activeSeason) return null
  const { trainingNpcList, bandDataListDict } = activeSeason.data

  function patch(i: number, p: Partial<TrainingNpcList>) {
    updateSeason(activeSeasonId!, d => ({
      ...d,
      trainingNpcList: d.trainingNpcList.map((n, idx) => idx === i ? { ...n, ...p } : n),
    }))
  }

  function add() {
    updateSeason(activeSeasonId!, d => ({
      ...d,
      trainingNpcList: [...d.trainingNpcList, { npcId: '', charId: '', nameCardSkinId: '', medalCount: 0, bandId: '' }],
    }))
  }

  function del(i: number) {
    updateSeason(activeSeasonId!, d => ({ ...d, trainingNpcList: d.trainingNpcList.filter((_, idx) => idx !== i) }))
  }

  const bandOptions = Object.keys(bandDataListDict).map(id => ({ value: id, label: id }))

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Title order={5}>训练 NPC 列表（trainingNpcList）</Title>
        <Button size="xs" leftSection={<IconPlus size={12} />} variant="light" onClick={add}>新增</Button>
      </Group>
      <Table fz="sm" withTableBorder>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>#</Table.Th>
            <Table.Th>npcId</Table.Th>
            <Table.Th>charId（干员）</Table.Th>
            <Table.Th>nameCardSkinId</Table.Th>
            <Table.Th>medalCount</Table.Th>
            <Table.Th>bandId</Table.Th>
            <Table.Th></Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {trainingNpcList.map((npc, i) => (
            <Table.Tr key={i}>
              <Table.Td>{i + 1}</Table.Td>
              <Table.Td><CTextInput size="xs" collabField={`npc[${i}].npcId`} value={npc.npcId} w={160} onChange={e => patch(i, { npcId: e.target.value })} /></Table.Td>
              <Table.Td>
                <Stack gap={2}>
                  <CTextInput size="xs" collabField={`npc[${i}].charId`} value={npc.charId} w={160} onChange={e => patch(i, { charId: e.target.value })} />
                  <Text size="9px" c="dimmed">{getCharName(npc.charId)}</Text>
                </Stack>
              </Table.Td>
              <Table.Td><CTextInput size="xs" collabField={`npc[${i}].skinId`} value={npc.nameCardSkinId} w={160} onChange={e => patch(i, { nameCardSkinId: e.target.value })} /></Table.Td>
              <Table.Td><CNumberInput size="xs" collabField={`npc[${i}].medal`} value={npc.medalCount} min={0} w={70} onChange={v => patch(i, { medalCount: Number(v) })} /></Table.Td>
              <Table.Td><CSelect size="xs" collabField={`npc[${i}].band`} value={npc.bandId} data={bandOptions} searchable w={160} onChange={v => patch(i, { bandId: v || '' })} /></Table.Td>
              <Table.Td><ActionIcon size="sm" variant="subtle" color="red" onClick={() => del(i)}><IconTrash size={12} /></ActionIcon></Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Stack>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MilestoneEditor: milestoneList
// ─────────────────────────────────────────────────────────────────────────────
function MilestoneEditor({ store }: Props) {
  const { activeSeason, activeSeasonId, updateSeason } = store
  if (!activeSeason) return null
  const { milestoneList } = activeSeason.data

  const itemTypeOptions: { value: ItemType; label: string }[] = [
    { value: 'GOLD', label: '金币' },
    { value: 'MATERIAL', label: '材料' },
    { value: 'ACTIVITY_ITEM', label: '活动道具' },
    { value: 'CARD_EXP', label: '卡牌经验' },
    { value: 'CHAR_SKIN', label: '干员外观' },
    { value: 'PLAYER_AVATAR', label: '玩家头像' },
  ]

  function patch(i: number, p: Partial<MilestoneList>) {
    updateSeason(activeSeasonId!, d => ({
      ...d,
      milestoneList: d.milestoneList.map((m, idx) => idx === i ? { ...m, ...p } : m),
    }))
  }

  function patchItem(i: number, p: Partial<MilestoneList['rewardItem']>) {
    updateSeason(activeSeasonId!, d => ({
      ...d,
      milestoneList: d.milestoneList.map((m, idx) => idx === i ? { ...m, rewardItem: { ...m.rewardItem, ...p } } : m),
    }))
  }

  function add() {
    updateSeason(activeSeasonId!, d => ({
      ...d,
      milestoneList: [...d.milestoneList, { milestoneId: '', milestoneLvl: 0, tokenNum: 0, rewardItem: { id: '', count: 1, type: 'GOLD' }, availableTime: 0 }],
    }))
  }

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Title order={5}>里程碑列表（milestoneList）</Title>
        <Button size="xs" leftSection={<IconPlus size={12} />} variant="light" onClick={add}>新增</Button>
      </Group>
      <Table fz="xs" withTableBorder>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>milestoneId</Table.Th>
            <Table.Th>等级</Table.Th>
            <Table.Th>代币数</Table.Th>
            <Table.Th>奖励类型</Table.Th>
            <Table.Th>奖励 ID</Table.Th>
            <Table.Th>数量</Table.Th>
            <Table.Th>可用时间</Table.Th>
            <Table.Th></Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {milestoneList.map((m, i) => (
            <Table.Tr key={i}>
              <Table.Td><CTextInput size="xs" collabField={`ms[${i}].id`} value={m.milestoneId} w={160} onChange={e => patch(i, { milestoneId: e.target.value })} /></Table.Td>
              <Table.Td><CNumberInput size="xs" collabField={`ms[${i}].lvl`} value={m.milestoneLvl} w={70} onChange={v => patch(i, { milestoneLvl: Number(v) })} /></Table.Td>
              <Table.Td><CNumberInput size="xs" collabField={`ms[${i}].token`} value={m.tokenNum} w={80} onChange={v => patch(i, { tokenNum: Number(v) })} /></Table.Td>
              <Table.Td><CSelect size="xs" collabField={`ms[${i}].type`} value={m.rewardItem.type} data={itemTypeOptions} w={110} onChange={v => patchItem(i, { type: v as ItemType })} /></Table.Td>
              <Table.Td><CTextInput size="xs" collabField={`ms[${i}].itemId`} value={m.rewardItem.id} w={140} onChange={e => patchItem(i, { id: e.target.value })} /></Table.Td>
              <Table.Td><CNumberInput size="xs" collabField={`ms[${i}].count`} value={m.rewardItem.count} w={70} min={1} onChange={v => patchItem(i, { count: Number(v) })} /></Table.Td>
              <Table.Td><CNumberInput size="xs" collabField={`ms[${i}].time`} value={m.availableTime} w={100} onChange={v => patch(i, { availableTime: Number(v) })} /></Table.Td>
              <Table.Td>
                <ActionIcon size="xs" variant="subtle" color="red"
                  onClick={() => updateSeason(activeSeasonId!, d => ({ ...d, milestoneList: d.milestoneList.filter((_, j) => j !== i) }))}>
                  <IconTrash size={10} />
                </ActionIcon>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Stack>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PlayerTitleEditor: playerTitleDataDict
// ─────────────────────────────────────────────────────────────────────────────
function PlayerTitleEditor({ store }: Props) {
  const { activeSeason, activeSeasonId, updateSeason } = store
  if (!activeSeason) return null
  const { playerTitleDataDict } = activeSeason.data
  const keys = Object.keys(playerTitleDataDict) as (keyof typeof playerTitleDataDict)[]

  return (
    <Stack gap="md">
      <Title order={5}>玩家称号（playerTitleDataDict）</Title>
      <Table fz="sm" withTableBorder>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Key</Table.Th>
            <Table.Th>id</Table.Th>
            <Table.Th>picId</Table.Th>
            <Table.Th>txt（显示文本）</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {keys.map(k => {
            const c = playerTitleDataDict[k]
            return (
              <Table.Tr key={k}>
                <Table.Td><Text ff="monospace" size="xs">{k}</Text></Table.Td>
                <Table.Td>
                  <CTextInput size="xs" collabField={`title.${k}.id`} value={c.id} w={160}
                    onChange={e => updateSeason(activeSeasonId!, d => ({ ...d, playerTitleDataDict: { ...d.playerTitleDataDict, [k]: { ...d.playerTitleDataDict[k], id: e.target.value } } }))} />
                </Table.Td>
                <Table.Td>
                  <CTextInput size="xs" collabField={`title.${k}.picId`} value={c.picId} w={160}
                    onChange={e => updateSeason(activeSeasonId!, d => ({ ...d, playerTitleDataDict: { ...d.playerTitleDataDict, [k]: { ...d.playerTitleDataDict[k], picId: e.target.value } } }))} />
                </Table.Td>
                <Table.Td>
                  <CTextInput size="xs" collabField={`title.${k}.txt`} value={c.txt} w={200}
                    onChange={e => updateSeason(activeSeasonId!, d => ({ ...d, playerTitleDataDict: { ...d.playerTitleDataDict, [k]: { ...d.playerTitleDataDict[k], txt: e.target.value } } }))} />
                </Table.Td>
              </Table.Tr>
            )
          })}
        </Table.Tbody>
      </Table>
    </Stack>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ConstDataEditor: constData
// ─────────────────────────────────────────────────────────────────────────────
function ConstDataEditor({ store }: Props) {
  const { activeSeason, activeSeasonId, updateSeason } = store
  if (!activeSeason) return null
  const { constData } = activeSeason.data

  function patch(p: Partial<typeof constData>) {
    updateSeason(activeSeasonId!, d => ({ ...d, constData: { ...d.constData, ...p } }))
  }

  const enemyTypeOptions = ['INVISIBLE', 'FLY', 'ELEMENT', 'SPECIAL', 'REFLECTION', 'TIMES', 'DOT'].map(v => ({ value: v, label: v }))

  return (
    <Stack gap="md">
      <Title order={5}>常量配置（constData）</Title>
      <Grid gutter="sm">
        <Grid.Col span={3}><CNumberInput label="商店刷新价格" value={constData.shopRefreshPrice} onChange={v => patch({ shopRefreshPrice: Number(v) })} /></Grid.Col>
        <Grid.Col span={3}><CNumberInput label="整备区最大棋子数" value={constData.maxDeckChessCnt} onChange={v => patch({ maxDeckChessCnt: Number(v) })} /></Grid.Col>
        <Grid.Col span={3}><CNumberInput label="战场最大棋子数" value={constData.maxBattleChessCnt} onChange={v => patch({ maxBattleChessCnt: Number(v) })} /></Grid.Col>
        <Grid.Col span={3}><CNumberInput label="仓库上限" value={constData.storeCntMax} onChange={v => patch({ storeCntMax: Number(v) })} /></Grid.Col>
        <Grid.Col span={3}><CNumberInput label="借用次数" value={constData.borrowCount} onChange={v => patch({ borrowCount: Number(v) })} /></Grid.Col>
        <Grid.Col span={3}><CNumberInput label="HP 扣除上限" value={constData.costPlayerHpLimit} onChange={v => patch({ costPlayerHpLimit: Number(v) })} /></Grid.Col>
        <Grid.Col span={3}><CNumberInput label="日常任务参数" value={constData.dailyMissionParam} onChange={v => patch({ dailyMissionParam: Number(v) })} /></Grid.Col>
        <Grid.Col span={6}><CTextInput label="fallback 盟约 ID" value={constData.fallbackBondId} onChange={e => patch({ fallbackBondId: e.target.value })} /></Grid.Col>
        <Grid.Col span={6}><CTextInput label="里程碑 ID (milestoneId)" value={constData.milestoneId} onChange={e => patch({ milestoneId: e.target.value })} /></Grid.Col>
        <Grid.Col span={6}><CTextInput label="里程碑追踪 ID" value={constData.milestoneTrackId} onChange={e => patch({ milestoneTrackId: e.target.value })} /></Grid.Col>
        <Grid.Col span={6}><CTextInput label="日常任务名称" value={constData.dailyMissionName} onChange={e => patch({ dailyMissionName: e.target.value })} /></Grid.Col>
        <Grid.Col span={12}><CTextInput label="日常任务规则" value={constData.dailyMissionRule} onChange={e => patch({ dailyMissionRule: e.target.value })} /></Grid.Col>
        <Grid.Col span={6}><CTextInput label="训练关卡盟约 ID (trstageBandId)" value={constData.trstageBandId} onChange={e => patch({ trstageBandId: e.target.value })} /></Grid.Col>
        <Grid.Col span={6}><CTextInput label="训练关卡 BOSS ID (trstageBossId)" value={constData.trstageBossId} onChange={e => patch({ trstageBossId: e.target.value })} /></Grid.Col>
        <Grid.Col span={6}><CTextInput label="训练关卡 ID (trStageId)" value={constData.trStageId} onChange={e => patch({ trStageId: e.target.value })} /></Grid.Col>
        <Grid.Col span={6}><CTextInput label="训练模式 ID (trainingModeId)" value={constData.trainingModeId} onChange={e => patch({ trainingModeId: e.target.value })} /></Grid.Col>
        <Grid.Col span={6}><CTextInput label="单人逃脱战斗模板 Map" value={constData.escapedBattleTemplateMapSinglePlayer} onChange={e => patch({ escapedBattleTemplateMapSinglePlayer: e.target.value })} /></Grid.Col>
        <Grid.Col span={6}><CTextInput label="多人逃脱战斗模板 Map" value={constData.escapedBattleTemplateMapMultiPlayer} onChange={e => patch({ escapedBattleTemplateMapMultiPlayer: e.target.value })} /></Grid.Col>
        <Grid.Col span={6}><CTextInput label="WebBusType" value={constData.webBusType} onChange={e => patch({ webBusType: e.target.value })} /></Grid.Col>
      </Grid>
      <Divider label="训练特殊敌人类型 (trSpecialEnemyTypes)" labelPosition="left" />
      <CMultiSelect
        value={constData.trSpecialEnemyTypes}
        data={enemyTypeOptions}
        onChange={v => patch({ trSpecialEnemyTypes: v as any[] })}
      />
      <Divider label="训练盟约 IDs (trBondIds)" labelPosition="left" />
      <KeyListField label="" keys={constData.trBondIds} collabPrefix="trBondIds" onChange={v => patch({ trBondIds: v })} />
      <Divider label="训练禁用盟约 IDs (trBannedBondIds)" labelPosition="left" />
      <KeyListField label="" keys={constData.trBannedBondIds} collabPrefix="trBannedBondIds" onChange={v => patch({ trBannedBondIds: v })} />
    </Stack>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// BanConfigEditor: banConfig
// ─────────────────────────────────────────────────────────────────────────────
function BanConfigEditor({ store }: Props) {
  const { activeSeason, activeSeasonId, updateSeason } = store
  const banConfig = activeSeason?.data.banConfig
  if (!activeSeason) return null
  const legacy = resolveLegacyBanConfig(activeSeason.data)

  function patch(p: Partial<BanConfig>) {
    updateSeason(activeSeasonId!, d => {
      const next: BanConfig = { ...(d.banConfig ?? {}) }

      if ('immuneBonds' in p) {
        const immuneBonds = p.immuneBonds?.map(v => v.trim()).filter(Boolean) ?? []
        if (p.immuneBonds !== undefined) next.immuneBonds = immuneBonds
        else delete next.immuneBonds
      }

      if ('coreBondIds' in p) {
        const coreBondIds = p.coreBondIds?.map(v => v.trim()).filter(Boolean) ?? []
        if (p.coreBondIds !== undefined) next.coreBondIds = coreBondIds
        else delete next.coreBondIds
      }

      if ('minorBondIds' in p) {
        const minorBondIds = p.minorBondIds?.map(v => v.trim()).filter(Boolean) ?? []
        if (p.minorBondIds !== undefined) next.minorBondIds = minorBondIds
        else delete next.minorBondIds
      }

      if ('coreBondBanCount' in p) {
        if (typeof p.coreBondBanCount === 'number') next.coreBondBanCount = p.coreBondBanCount
        else delete next.coreBondBanCount
      }

      if ('minorBondBanCount' in p) {
        if (typeof p.minorBondBanCount === 'number') next.minorBondBanCount = p.minorBondBanCount
        else delete next.minorBondBanCount
      }

      if ('mode' in p) { if (p.mode === undefined) delete next.mode; else next.mode = p.mode }

      if (Object.keys(next).length === 0) {
        const { banConfig: _ignored, ...rest } = d
        return rest
      }

      return { ...d, banConfig: next }
    })
  }

  if (inspectBondClassification(activeSeason.data).classification) return <Stack gap="md">
    <Title order={5}>Ban 配置</Title>
    <Button variant="light" onClick={() => store.navigateTo('bonds')}>进入盟约分类页面</Button>
    <BondClassificationManager store={store} />
    <KeyListField label="抽选排除名单（旧 immuneBonds，不是角色永久免疫）"
      keys={legacy.immuneBonds}
      collabPrefix="banConfig.immuneBonds" preserveDraft onChange={v => patch({ immuneBonds: v })} />
    <Text size="xs" c="dimmed">核心与小盟约的成员和数量由默认两类同步，回退使用这些旧字段；自定义类别不进入原版回退。</Text>
  </Stack>

  return (
    <Stack gap="md">
      <Title order={5}>Ban 配置（banConfig）</Title>
      <Button variant="light" onClick={() => store.navigateTo('bonds')}>管理盟约分类与规则 tag</Button>
      <BondClassificationManager store={store} />
      <Text size="sm" c="dimmed">以下旧字段用于原版 normal 回退。旧 mode: banCore 只作为主动迁移到 all 的依据，不再独立生效。</Text>
      <Text size="sm">禁用只影响角色供应；已拥有的角色仍可激活盟约。模式的 active/inactive 盟约名单独立控制效果启用。</Text>
      {(['immuneBonds', 'coreBondIds', 'minorBondIds'] as const).map(field => <Group key={field}><Text size="xs">{field}：{banConfig?.[field] === undefined ? '使用默认' : !Array.isArray(banConfig[field]) ? '字段无效，使用服务器回退值' : banConfig[field]!.length ? '赛季声明' : '明确为空'}</Text><Button size="xs" variant="light" onClick={() => patch({[field]: undefined})}>使用默认</Button><Button size="xs" variant="light" onClick={() => patch({[field]: []})}>明确为空</Button></Group>)}
      <Grid gutter="sm">
        <Grid.Col span={12}>
          <KeyListField
            label="免疫禁用列表(immuneBonds)"
            keys={legacy.immuneBonds}
            collabPrefix="banConfig.immuneBonds"
            preserveDraft
            onChange={v => patch({ immuneBonds: v })}
          />
          <Text size="xs" c="dimmed">默认值：根据赛季而定，第一期值是助力协防远见，第二期值是绝技协防调和投资人。</Text>
          <Text size="xs" c="dimmed">ACT1 `deputShip`, `emptyShip`, `visiShip` </Text>
          <Text size="xs" c="dimmed">ACT2 `suntShip`, `emptyShip`, `maniShip`, `investShip` </Text>
        </Grid.Col>
        <Grid.Col span={12}>
          <KeyListField
            label="核心盟约列表(coreBondIds)"
            keys={legacy.coreBondIds}
            collabPrefix="banConfig.coreBondIds"
            preserveDraft
            onChange={v => patch({ coreBondIds: v })}
          />
          <Text size="xs" c="dimmed">默认值：8 个核心盟约，未配置时先显示这 8 个默认项。</Text>
          <Text size="xs" c="dimmed">`yanShip`, `sargonShip`, `victoriaShip`, `kjeragShip`, `lateranoShip`, `egirShip`, `kazimierzShip`, `siracusaShip`</Text>
        </Grid.Col>
        <Grid.Col span={12}>
          <KeyListField
            label="次要盟约列表(minorBondIds)"
            keys={legacy.minorBondIds}
            collabPrefix="banConfig.minorBondIds"
            preserveDraft
            onChange={v => patch({ minorBondIds: v })}
          />
          <Text size="xs" c="dimmed">可选，不填则自动从赛季所有羁绊中排除核心和免疫羁绊得到。填写后只从这些羁绊中抽取次要 ban。</Text>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Stack gap={4}>
            <CNumberInput
              label="主盟约禁用数(coreBondBanCount)"
              collabField="banConfig.coreBondBanCount"
              value={banConfig?.coreBondBanCount === undefined ? '' : legacy.coreBondBanCount}
              min={0}
              onChange={v => patch({ coreBondBanCount: v === '' ? undefined : Number(v) })}
            />
            <Text size="xs" c="dimmed">默认值：ACT1 为 2，含卡西米尔盟约时为 3；非法数量使用内置值。</Text>
          </Stack>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Stack gap={4}>
            <CNumberInput
              label="副盟约禁用数(minorBondBanCount)"
              collabField="banConfig.minorBondBanCount"
              value={banConfig?.minorBondBanCount === undefined ? '' : legacy.minorBondBanCount}
              min={0}
              onChange={v => patch({ minorBondBanCount: v === '' ? undefined : Number(v) })}
            />
            <Text size="xs" c="dimmed">默认值：ACT1 为 2，含卡西米尔盟约时为 4；非法数量使用内置值。</Text>
          </Stack>
        </Grid.Col>
      </Grid>
    </Stack>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// DiyChessEditor: diyChessDict
// ─────────────────────────────────────────────────────────────────────────────
function DiyChessEditor({ store }: Props) {
  const { activeSeason, activeSeasonId, updateSeason } = store
  if (!activeSeason) return null
  const { diyChessDict } = activeSeason.data
  const keys = Object.keys(diyChessDict) as (keyof typeof diyChessDict)[]

  return (
    <Stack gap="md">
      <Title order={5}>DIY 棋子映射（diyChessDict）</Title>
      <Text size="sm" c="dimmed">key 为 DIY 棋子的 chessId，value 为对应的实际 charId。</Text>
      <Table fz="sm" withTableBorder>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>DIY chessId (key)</Table.Th>
            <Table.Th>charId (value)</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {keys.map(k => (
            <Table.Tr key={k}>
              <Table.Td><Text ff="monospace" size="xs">{k}</Text></Table.Td>
              <Table.Td>
                <CTextInput size="xs" collabField={`diy.${k}`} value={diyChessDict[k]} w={240}
                  onChange={e => updateSeason(activeSeasonId!, d => ({ ...d, diyChessDict: { ...d.diyChessDict, [k]: e.target.value } }))} />
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Stack>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// EffectChoiceEditor: effectChoiceInfoDict
// ─────────────────────────────────────────────────────────────────────────────
function EffectChoiceEditor({ store }: Props) {
  const { activeSeason, activeSeasonId, updateSeason } = store
  const [editingId, setEditingId] = useState<string | null>(null)
  const [addOpened, { open: openAdd, close: closeAdd }] = useDisclosure(false)
  const [newId, setNewId] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  if (!activeSeason) return null
  const { effectChoiceInfoDict, effectInfoDataDict } = activeSeason.data
  const list = Object.values(effectChoiceInfoDict).sort((a, b) => a.choiceEventId.localeCompare(b.choiceEventId))
  const editing = editingId ? effectChoiceInfoDict[editingId] : null

  function patch(id: string, p: Partial<typeof editing>) {
    updateSeason(activeSeasonId!, d => ({
      ...d,
      effectChoiceInfoDict: { ...d.effectChoiceInfoDict, [id]: { ...d.effectChoiceInfoDict[id], ...p } },
    }))
  }

  function add() {
    const id = newId.trim()
    if (!id) return
    if (effectChoiceInfoDict[id]) { notifications.show({ title: '已存在', message: `"${id}" 已存在`, color: 'red' }); return }
    updateSeason(activeSeasonId!, d => ({
      ...d,
      effectChoiceInfoDict: {
        ...d.effectChoiceInfoDict,
        [id]: { choiceEventId: id, choiceType: 'BUFF_SELECT', effectType: 'BUFF_GAIN', name: '战术决策' as any, desc: '进行协同调整，做好迎战准备。' as any, typeTxtColor: '#35d8b4' as any },
      },
    }))
    setEditingId(id); closeAdd(); setNewId('')
    notifications.show({ title: '已新增', message: `效果选项 ${id} 已创建`, color: 'teal' })
  }

  function del(id: string) {
    updateSeason(activeSeasonId!, d => { const n = { ...d.effectChoiceInfoDict }; delete n[id]; return { ...d, effectChoiceInfoDict: n } })
    if (editingId === id) setEditingId(null)
    setDeleteConfirm(null)
  }

  const choiceTypeOptions: { value: ChoiceType; label: string }[] = [
    { value: 'EQUIP_FREE', label: 'EQUIP_FREE（机密商店）' },
    { value: 'BOUNTY_HUNT', label: 'BOUNTY_HUNT（悬赏决策）' },
    { value: 'BUFF_SELECT', label: 'BUFF_SELECT（战术决策）' },
    { value: 'PERSONAL_CHOOSE', label: 'PERSONAL_CHOOSE（道具补给）' },
  ]

  const effectTypeOptions: { value: EffectType; label: string }[] = [
    { value: 'EQUIP', label: 'EQUIP' },
    { value: 'ENEMY_GAIN', label: 'ENEMY_GAIN' },
    { value: 'BUFF_GAIN', label: 'BUFF_GAIN' },
    { value: 'BAND_INITIAL', label: 'BAND_INITIAL' },
    { value: 'CHAR_MAP', label: 'CHAR_MAP' },
    { value: 'ENEMY', label: 'ENEMY' },
    { value: 'BOND', label: 'BOND' },
  ]

  const effectOptions = [
    { value: '', label: '（无）' },
    ...Object.keys(effectInfoDataDict).map(id => ({ value: id, label: id })),
  ]

  return (
    <>
      <EditorSplitLayout>
        <EditorListPane>

            <Group justify="space-between">
              <Title order={5}>效果选项列表</Title>
              <Group gap="xs">
                <Text size="xs" c="dimmed">{list.length}</Text>
                <Button size="xs" leftSection={<IconPlus size={12} />} variant="light" onClick={openAdd}>新增</Button>
              </Group>
            </Group>
            <EditorListScrollArea><Stack gap="xs">
              {list.map(c => (
                <Group key={c.choiceEventId} justify="space-between" wrap="nowrap"
                  style={{ cursor: 'pointer', padding: '6px 8px', borderRadius: 6, border: `1px solid ${editingId === c.choiceEventId ? 'var(--mantine-color-teal-6)' : 'var(--mantine-color-dark-4)'}` }}
                  onClick={() => setEditingId(c.choiceEventId)}>
                  <div>
                    <Text size="sm" ff="monospace">{c.choiceEventId}</Text>
                    <Group gap="xs">
                      <Badge size="xs" color="blue">{c.choiceType}</Badge>
                      <Badge size="xs" color="teal">{c.effectType}</Badge>
                    </Group>
                  </div>
                  <ActionIcon size="sm" variant="subtle" color="red"
                    onClick={ev => { ev.stopPropagation(); setDeleteConfirm(c.choiceEventId) }}>
                    <IconTrash size={12} />
                  </ActionIcon>
                </Group>
              ))}
            </Stack></EditorListScrollArea>

        </EditorListPane>
        <EditorDetailPane>
          <CollabEditingProvider itemId={editingId}>
          {editing ? (
            <Stack gap="md">
              <Text ff="monospace" size="sm" c="dimmed">{editing.choiceEventId}</Text>
              <Grid gutter="sm">
                <Grid.Col span={6}>
                  <CSelect label="选项类型 (choiceType)" value={editing.choiceType} data={choiceTypeOptions}
                    onChange={v => patch(editing.choiceEventId, { choiceType: v as ChoiceType })} />
                </Grid.Col>
                <Grid.Col span={6}>
                  <CSelect label="效果类型 (effectType)" value={editing.effectType} data={effectTypeOptions}
                    onChange={v => patch(editing.choiceEventId, { effectType: v as EffectType })} />
                </Grid.Col>
                <Grid.Col span={6}>
                  <CTextInput label="名称 (name)" value={editing.name}
                    onChange={e => patch(editing.choiceEventId, { name: e.target.value as any })} />
                </Grid.Col>
                <Grid.Col span={6}>
                  <CTextInput label="颜色 (typeTxtColor)" value={editing.typeTxtColor}
                    onChange={e => patch(editing.choiceEventId, { typeTxtColor: e.target.value as any })} />
                </Grid.Col>
                <Grid.Col span={12}>
                  <CTextarea label="描述 (desc)" value={editing.desc} autosize minRows={2}
                    onChange={e => patch(editing.choiceEventId, { desc: e.target.value as any })} />
                </Grid.Col>
              </Grid>
            </Stack>
          ) : <Text c="dimmed" ta="center" mt="xl">← 选择左侧条目</Text>}
          </CollabEditingProvider>
        </EditorDetailPane>
      </EditorSplitLayout>
      <Modal opened={addOpened} onClose={closeAdd} title="新增效果选项" size="sm">
        <Stack gap="md">
          <CTextInput label="choiceEventId" value={newId} onChange={e => setNewId(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()} />
          <Group justify="flex-end"><Button variant="subtle" onClick={closeAdd}>取消</Button><Button onClick={add} disabled={!newId.trim()}>创建</Button></Group>
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
