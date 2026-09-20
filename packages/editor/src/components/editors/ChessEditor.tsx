import { NumberInput, Select } from '@mantine/core'
import { SegmentedIdInput } from '../shared/SegmentedIdInput'
import { commitCreation } from '../shared/commitCreation'
import { useRevealEntry } from '../shared/useRevealEntry'
import { createChessPair } from '../shared/creationActions'
import { joinId, splitId, matchingChessBond, parseChessId, resolveChessLevel, suggestChess, validateChessId } from '../shared/idNaming'
import {
  Stack, Card, Group, Text, Badge, Grid,
  ActionIcon, Title, Divider,
  ScrollArea, Table, Tabs, Tooltip,
  Button, Modal,
} from '@mantine/core'
import { CTextInput, CNumberInput, CSelect, CMultiSelect, CSwitch, CSegmentedControl, CollabEditingProvider } from '../collab/CollabInputs'
import { IconChevronRight, IconTrash, IconPlus } from '@tabler/icons-react'
import { useState, useMemo, useEffect, useRef } from 'react'
import { useDisclosure } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import type { CharChessDataDict, CharShopChessData, ShopCharChessInfoDatumEvolvePhase, ChessType } from '@autochess-editor/shared'
import { chessTypeLabel, evolvePhaseLabel, getCharName, normalizeSeasonDataForRuntime } from '@autochess-editor/shared'
import { ChessLevelBadge } from '../shared/ChessLevelBadge'
import { characterNameMap } from '@autochess-editor/shared'
import type { DataStore } from '../../store/dataStore'
import { PresenceIndicator } from '../collab/PresenceIndicator'
import { useCollab } from '../../context/CollabContext'

interface Props { store: DataStore }

// 生成新棋子的默认条目
function makeDefaultShopChess(chessId: string, goldenChessId: string): CharShopChessData {
  return {
    chessId,
    goldenChessId,
    chessLevel: 1,
    shopLevelSortId: 999,
    chessType: 'PRESET',
    charId: null,
    tmplId: null,
    defaultSkillIndex: 0,
    defaultUniEquipId: null,
    backupCharId: chessId,
    backupTmplId: null,
    backupCharSkillIndex: 0,
    backupCharUniEquipId: null,
    backupCharPotRank: 0,
    isHidden: false,
  }
}

function makeDefaultChessData(chessId: string,goldenChessId:string,identifier: number, isGolden: boolean,): CharChessDataDict {
  return {
    chessId,
    identifier,
    isGolden,
    status: {
      evolvePhase: isGolden ? 'PHASE_2' : 'PHASE_1',
      charLevel: isGolden ? 60 : 55,
      skillLevel: 7,
      favorPoint: 0,
      equipLevel: isGolden ? 1 : 0,
    },
    upgradeChessId: isGolden ? null : goldenChessId,
    upgradeNum: isGolden ? 0 : 3,
    bondIds: [],
    garrisonIds: null,
  }
}

// charId 候选列表
const charIdOptions = Object.entries(characterNameMap as Record<string, string>)
  .filter(([id]) => id.startsWith('char_'))
  .map(([id, name]) => ({ value: id, label: `${name} (${id})` }))
  .sort((a, b) => a.label.localeCompare(b.label))

export function ChessEditor({ store }: Props) {
  const { activeSeason, activeSeasonId, updateSeason, focusId, setFocusId, navigateTo } = store
  const { updatePresence, followTargetField } = useCollab()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [statusTab, setStatusTab] = useState<string | null>('normal')

  useEffect(() => { updatePresence('chess', editingId); return () => updatePresence('chess', null) }, [editingId])

  // Auto-switch tab when following someone editing golden/normal status
  useEffect(() => {
    if (followTargetField?.startsWith('g.')) setStatusTab('golden')
    else if (followTargetField?.startsWith('n.')) setStatusTab('normal')
  }, [followTargetField])

  const [search, setSearch] = useState('')
  const [levelFilter, setLevelFilter] = useState<string>('all')
  const [addOpened, { open: openAdd, close: closeAdd }] = useDisclosure(false)
  const [newChessId, setNewChessId] = useState('')
  const [newLevel, setNewLevel] = useState<number | string>(1)
  const [newSort, setNewSort] = useState<number | string>(1)
  const [newBond, setNewBond] = useState<string | null | undefined>(undefined)
  const draftDefaults = useRef<ReturnType<typeof suggestChess> | null>(null)
  const { root: listRoot, reveal } = useRevealEntry()
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const { charShopChessDatas, charChessDataDict, bondInfoDict, chessNormalIdLookupDict, garrisonDataDict } = activeSeason?.data ?? {}

  // 切换赛季时清空选中
  useEffect(() => {
    setEditingId(null)
  }, [activeSeasonId])

  useEffect(() => {
    if (!focusId) return
    let targetId: string | null = null
    // 直接是 _a
    if (charShopChessDatas && focusId in charShopChessDatas) {
      targetId = focusId
    } else {
      // 是 _b，找对应 _a
      const normalId = chessNormalIdLookupDict?.[focusId]
      if (normalId && charShopChessDatas && normalId in charShopChessDatas) {
        targetId = normalId
      }
    }
    if (targetId) {
      setEditingId(targetId)
      // Switch filter to target chess's level
      const chess = charShopChessDatas?.[targetId]
      if (chess) {
        setLevelFilter(String(chess.chessLevel))
      }
      setFocusId(null)
    }
  }, [focusId, charShopChessDatas, chessNormalIdLookupDict, setFocusId, levelFilter])

  if (!activeSeason || !charShopChessDatas || !charChessDataDict) {
    return <Text c="dimmed">请先加载赛季数据</Text>
  }

  // 只显示有 charShopChessDatas 的普通棋子（_a），金棋子(_b)在同一条目内编辑
  const shopList = useMemo(() => {
    return Object.values(charShopChessDatas)
      .sort((a, b) => a.chessLevel - b.chessLevel || a.shopLevelSortId - b.shopLevelSortId)
  }, [charShopChessDatas])

  const filtered = useMemo(() => {
    return shopList.filter(c => {
      const name = getCharName(c.charId)
      const levelOk = levelFilter === 'all' || c.chessLevel === Number(levelFilter)
      const searchOk = !search || name.includes(search) || c.chessId.includes(search) || (c.charId ?? '').includes(search)
      return levelOk && searchOk
    })
  }, [shopList, search, levelFilter])

  const editing = editingId ? charShopChessDatas[editingId] : null
  const editingChessNormal = editingId ? charChessDataDict[editingId] : null
  const goldenChessId = editing?.goldenChessId
  const editingChessGolden = goldenChessId ? charChessDataDict[goldenChessId] : null

  function patchShop(id: string, patch: Partial<CharShopChessData>) {
    updateSeason(activeSeasonId!, data => ({
      ...data,
      charShopChessDatas: { ...data.charShopChessDatas, [id]: { ...data.charShopChessDatas[id], ...patch } },
    }))
  }

  function patchChess(id: string, patch: Partial<CharChessDataDict>) {
    updateSeason(activeSeasonId!, data => ({
      ...data,
      charChessDataDict: { ...data.charChessDataDict, [id]: { ...data.charChessDataDict[id], ...patch } },
    }))
  }

  function patchChessStatus(id: string, patch: Partial<CharChessDataDict['status']>) {
    updateSeason(activeSeasonId!, data => ({
      ...data,
      charChessDataDict: {
        ...data.charChessDataDict,
        [id]: { ...data.charChessDataDict[id], status: { ...data.charChessDataDict[id].status, ...patch } },
      },
    }))
  }

  const finalChessId = joinId(splitId(newChessId))
  const newGoldenId = finalChessId.replace(/_a$/, '_b')
  const boundBond = newBond === undefined ? matchingChessBond(finalChessId, activeSeason.data) : newBond
  const chessIdError = validateChessId(finalChessId, activeSeason.data)
  const levelError = typeof newLevel !== 'number' || !Number.isInteger(newLevel) || newLevel < 1 || newLevel > 6
    ? '请选择 1–6 星' : null
  const sortError = typeof newSort !== 'number' || !Number.isInteger(newSort) || newSort < 0
    ? '请填写非负整数排序' : null
  const namingLevelError = /^chess_[^_]+_[^_]*_\d+_a$/.test(finalChessId)
    && Number(splitId(finalChessId)[2]) !== newLevel ? 'ID 星级段需要与实际星级一致' : null
  const creationError = chessIdError ?? levelError ?? sortError ?? namingLevelError
  function applySuggestion(level: number) {
    const suggestion = suggestChess(store.getSeason(activeSeasonId!)?.data ?? activeSeason!.data, level)
    draftDefaults.current = suggestion
    setNewChessId(suggestion.id); setNewLevel(level); setNewSort(suggestion.sort); setNewBond(undefined)
  }
  function openCreate() {
    applySuggestion(resolveChessLevel(levelFilter, editing ?? undefined)); openAdd()
  }
  function changeNewId(value: string) {
    setNewChessId(value)
    const parsed = parseChessId(joinId(splitId(value)))
    if (parsed && parsed.level !== newLevel) {
      const suggestion = suggestChess(activeSeason!.data, parsed.level)
      if (newSort === draftDefaults.current?.sort) setNewSort(suggestion.sort)
      draftDefaults.current = suggestion
      setNewLevel(parsed.level)
    }
  }
  function changeNewLevel(value: number | string) {
    setNewLevel(value)
    if (typeof value !== 'number' || value < 1 || value > 6) return
    const suggestion = suggestChess(activeSeason!.data, value)
    const previous = draftDefaults.current
    const parts = splitId(newChessId)
    if (parts.length === 5 && parts[0] === 'chess') {
      const previousParts = previous ? splitId(previous.id) : []
      const suggestedParts = splitId(suggestion.id)
      for (const index of [1, 3]) if (parts[index] === previousParts[index]) parts[index] = suggestedParts[index]
      parts[2] = String(value)
      setNewChessId(parts.join('_'))
    }
    if (newSort === previous?.sort) setNewSort(suggestion.sort)
    draftDefaults.current = suggestion
  }
  function addChess() {
    if (creationError) return
    const id = finalChessId
    if (!commitCreation(store, data => createChessPair(data, {
      id, level: Number(newLevel), sort: Number(newSort), bondId: boundBond,
      shop: makeDefaultShopChess(id, newGoldenId),
      normal: makeDefaultChessData(id, newGoldenId, 0, false),
      golden: makeDefaultChessData(newGoldenId, newGoldenId, 0, true),
    }))) return
    setEditingId(id); setLevelFilter(String(newLevel)); setStatusTab('normal')
    if (search && !id.includes(search) && !getCharName(null).includes(search)) setSearch('')
    reveal(id)
    closeAdd(); setNewChessId('')
    notifications.show({ title: '已新增', message: `棋子 ${id} 及其精锐版 ${newGoldenId} 已创建`, color: 'teal' })
  }

  function deleteChess(id: string) {
    const shopData = charShopChessDatas[id]
    const goldenId = shopData?.goldenChessId
    updateSeason(activeSeasonId!, data => {
      const nextShop = { ...data.charShopChessDatas }
      delete nextShop[id]
      const nextChess = { ...data.charChessDataDict }
      delete nextChess[id]
      if (goldenId) delete nextChess[goldenId]
      const nextLookup = { ...data.chessNormalIdLookupDict }
      delete nextLookup[id]
      if (goldenId) delete nextLookup[goldenId]
      return normalizeSeasonDataForRuntime({
        ...data,
        charShopChessDatas: nextShop,
        charChessDataDict: nextChess,
        chessNormalIdLookupDict: nextLookup,
      })
    })
    if (editingId === id) setEditingId(null)
    setDeleteConfirm(null)
    notifications.show({ title: '已删除', message: `棋子 ${id}${goldenId ? ` 及精锐 ${goldenId}` : ''} 已删除`, color: 'orange' })
  }

  const allBondOptions = Object.entries(bondInfoDict ?? {}).map(([id, b]) => ({ value: id, label: b.name }))
  const priceInfo = editingId ? activeSeason.data.shopCharChessInfoData[editingId] : null

  function ChessStatusForm({ chessId, isGolden }: { chessId: string; isGolden: boolean }) {
    const chess = charChessDataDict[chessId]
    const prefix = isGolden ? 'g.' : 'n.'
    if (!chess) return <Text c="dimmed" size="sm">无数据（chessId: {chessId}）</Text>
    return (
      <Stack gap="sm">
        <Text size="xs" c="dimmed" ff="monospace">{chessId}</Text>
        <Grid gutter="sm">
          <Grid.Col span={4}>
            <CSelect
              label="精英阶段"
              collabField={`${prefix}evolvePhase`}
              value={chess.status.evolvePhase}
              data={[{ value: 'PHASE_1', label: '精英一' }, { value: 'PHASE_2', label: '精英二' }]}
              onChange={v => patchChessStatus(chessId, { evolvePhase: v as ShopCharChessInfoDatumEvolvePhase })}
            />
          </Grid.Col>
          <Grid.Col span={4}>
            <CNumberInput label="干员等级" collabField={`${prefix}charLevel`} value={chess.status.charLevel} min={1} onChange={v => patchChessStatus(chessId, { charLevel: Number(v) })} />
          </Grid.Col>
          <Grid.Col span={4}>
            <CNumberInput label="技能等级" collabField={`${prefix}skillLevel`} value={chess.status.skillLevel} min={1} max={10} onChange={v => patchChessStatus(chessId, { skillLevel: Number(v) })} />
          </Grid.Col>
          <Grid.Col span={4}>
            <CNumberInput label="信赖值" collabField={`${prefix}favorPoint`} value={chess.status.favorPoint} min={0} onChange={v => patchChessStatus(chessId, { favorPoint: Number(v) })} />
          </Grid.Col>
          <Grid.Col span={4}>
            <CNumberInput label="模组等级" collabField={`${prefix}equipLevel`} value={chess.status.equipLevel} min={0} max={3} onChange={v => patchChessStatus(chessId, { equipLevel: Number(v) })} />
          </Grid.Col>
          <Grid.Col span={4}>
            <CNumberInput label="升级所需数量" collabField={`${prefix}upgradeNum`} value={chess.upgradeNum} min={0} onChange={v => patchChess(chessId, { upgradeNum: Number(v) })} />
          </Grid.Col>
        </Grid>
        <Divider label="所属盟约" labelPosition="left" />
        <Group gap="xs" wrap="wrap">
          {chess.bondIds.map(bid => (
            <Badge key={bid} variant="light" color="teal" size="sm" style={{ cursor: 'pointer' }}
              onClick={() => navigateTo('bonds', bid)}>
              {bondInfoDict?.[bid]?.name ?? bid} ↗
            </Badge>
          ))}
          {chess.bondIds.length === 0 && <Text size="xs" c="dimmed">无盟约</Text>}
        </Group>
        <Divider label="干员特质（garrisonIds）" labelPosition="left" />
        <CMultiSelect
          size="xs"
          collabField={`${prefix}garrisonIds`}
          placeholder="选择特质..."
          searchable
          value={chess.garrisonIds ?? []}
          data={Object.keys(garrisonDataDict ?? {}).map(id => ({
            value: id,
            label: `${garrisonDataDict![id].garrisonDesc.replace(/<[^>]+>/g, '').slice(0, 25)} (${id})`,
          }))}
          onChange={v => patchChess(chessId, { garrisonIds: v.length > 0 ? v : null })}
          maxDropdownHeight={200}
        />
        <Group gap="xs" wrap="wrap">
          {(chess.garrisonIds ?? []).map(gid => (
            <Badge key={gid} variant="light" color="blue" size="sm" style={{ cursor: 'pointer' }}
              onClick={() => navigateTo('garrison', gid)}>
              {garrisonDataDict?.[gid]?.garrisonDesc.replace(/<[^>]+>/g, '').slice(0, 20) ?? gid} ↗
            </Badge>
          ))}
          {(chess.garrisonIds ?? []).length === 0 && <Text size="xs" c="dimmed">无特质</Text>}
        </Group>
      </Stack>
    )
  }

  return (
    <>
      <Grid gutter="md">
        <Grid.Col span={{ base: 12, md: 4 }}>
          <Stack gap="xs">
            <Group justify="space-between">
              <Title order={5}>棋子列表</Title>
              <Group gap="xs">
                <Text size="xs" c="dimmed">{filtered.length}/{shopList.length}</Text>
                <Button size="xs" leftSection={<IconPlus size={12} />} variant="light" onClick={openCreate}>新增</Button>
              </Group>
            </Group>
            <CTextInput placeholder="搜索干员名或 ID..." value={search} onChange={e => setSearch(e.target.value)} size="xs" />
            <CSegmentedControl
              size="xs" value={levelFilter} onChange={setLevelFilter}
              data={[
                { value: 'all', label: '全部' },
                { value: '1', label: '一阶' }, { value: '2', label: '二阶' },
                { value: '3', label: '三阶' }, { value: '4', label: '四阶' },
                { value: '5', label: '五阶' }, { value: '6', label: '六阶' },
              ]}
            />
            <ScrollArea h={520} ref={listRoot}>
              <Stack gap="xs">
                {filtered.map(chess => {
                  const name = getCharName(chess.charId)
                  const hasGolden = !!chess.goldenChessId && !!charChessDataDict[chess.goldenChessId]
                  return (
                    <Card key={chess.chessId} data-entry-id={chess.chessId} padding="sm" radius="md" withBorder
                      style={{ cursor: 'pointer', borderColor: editingId === chess.chessId ? 'var(--mantine-color-teal-6)' : undefined }}
                      onClick={() => setEditingId(chess.chessId)}
                    >
                      <Group justify="space-between" wrap="nowrap">
                        <div>
                          <Group gap="xs">
                            <Text fw={500} size="sm">{name}</Text>
                            <PresenceIndicator itemId={chess.chessId} />
                            <ChessLevelBadge level={chess.chessLevel} />
                            {hasGolden && <Badge size="xs" color="yellow" variant="light">有精锐</Badge>}
                            {chess.chessType === 'DIY' && <Badge size="xs" color="violet">自选</Badge>}
                            {chess.chessType === 'PRESET' && <Badge size="xs" color="gray">预置</Badge>}
                            {chess.isHidden && <Badge size="xs" color="dark">隐藏</Badge>}
                          </Group>
                          <Text size="xs" c="dimmed" ff="monospace">{chess.chessId}</Text>
                        </div>
                        <Group gap={4} wrap="nowrap">
                          <ActionIcon size="sm" variant="subtle" color="red"
                            onClick={e => { e.stopPropagation(); setDeleteConfirm(chess.chessId) }}>
                            <IconTrash size={12} />
                          </ActionIcon>
                        </Group>
                      </Group>
                    </Card>
                  )
                })}
              </Stack>
            </ScrollArea>
          </Stack>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 8 }}>
          {editing ? (
            <CollabEditingProvider itemId={editingId}>
            <Stack gap="md">
              <Group justify="space-between">
                <Group gap="xs">
                  <Title order={5}>{getCharName(editing.charId)}</Title>
                  <ChessLevelBadge level={editing.chessLevel} />
                </Group>
                <Text size="xs" c="dimmed" ff="monospace">{editing.chessId}</Text>
              </Group>

              <Divider label="商店配置" labelPosition="left" />
              <Grid gutter="sm">
                <Grid.Col span={12}>
                  <CSelect
                    label="绑定干员（charId）"
                    description="决定棋子使用哪位干员及其名称显示"
                    value={editing.charId ?? ''}
                    data={charIdOptions}
                    searchable
                    clearable
                    placeholder="搜索干员名..."
                    onChange={v => patchShop(editing.chessId, { charId: v || null })}
                  />
                </Grid.Col>
                <Grid.Col span={4}>
                  <CNumberInput label="棋子阶数" value={editing.chessLevel} min={1} max={6} onChange={v => patchShop(editing.chessId, { chessLevel: Number(v) })} />
                </Grid.Col>
                <Grid.Col span={4}>
                  <CNumberInput label="商店排序" value={editing.shopLevelSortId} onChange={v => patchShop(editing.chessId, { shopLevelSortId: Number(v) })} />
                </Grid.Col>
                <Grid.Col span={4}>
                  <CSelect
                    label="棋子类型"
                    value={editing.chessType}
                    data={['PRESET', 'NORMAL', 'DIY'].map(t => ({ value: t, label: `${chessTypeLabel[t]} (${t})` }))}
                    onChange={v => patchShop(editing.chessId, { chessType: v as ChessType })}
                  />
                </Grid.Col>
                <Grid.Col span={4}>
                  <CNumberInput label="默认技能索引" value={editing.defaultSkillIndex} min={0} onChange={v => patchShop(editing.chessId, { defaultSkillIndex: Number(v) })} />
                </Grid.Col>
                <Grid.Col span={4}>
                  <CNumberInput label="备用干员技能索引" value={editing.backupCharSkillIndex} min={0} onChange={v => patchShop(editing.chessId, { backupCharSkillIndex: Number(v) })} />
                </Grid.Col>
                <Grid.Col span={4}>
                  <CNumberInput label="备用干员潜能" value={editing.backupCharPotRank} min={0} onChange={v => patchShop(editing.chessId, { backupCharPotRank: Number(v) })} />
                </Grid.Col>
                <Grid.Col span={4}>
                  <CSwitch label="隐藏（不在商店显示）" checked={editing.isHidden}
                    onChange={e => patchShop(editing.chessId, { isHidden: e.target.checked })} mt="xl" />
                </Grid.Col>
              </Grid>

              {priceInfo && priceInfo.length > 0 && (
                <>
                  <Divider label="价格信息" labelPosition="left" />
                  <Table striped withTableBorder fz="xs">
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>阶段</Table.Th><Table.Th>精锐</Table.Th><Table.Th>精英</Table.Th>
                        <Table.Th>等级</Table.Th><Table.Th>技能</Table.Th>
                        <Table.Th>购买价格</Table.Th><Table.Th>出售价格</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {priceInfo.map((info, i) => (
                        <Table.Tr key={i}>
                          <Table.Td>{info.chessLevel}</Table.Td>
                          <Table.Td>{info.isGolden ? <Badge size="xs" color="yellow">是</Badge> : '否'}</Table.Td>
                          <Table.Td>{evolvePhaseLabel[info.evolvePhase] ?? info.evolvePhase}</Table.Td>
                          <Table.Td>{info.charLevel}</Table.Td>
                          <Table.Td>{info.skillLevel}</Table.Td>
                          <Table.Td c="yellow">{info.purchasePrice} 金</Table.Td>
                          <Table.Td c="teal">{info.chessSoldPrice} 金</Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </>
              )}

              <Divider label="棋子状态" labelPosition="left" />
              <Tabs value={statusTab} onChange={setStatusTab}>
                <Tabs.List>
                  <Tabs.Tab value="normal">普通</Tabs.Tab>
                  {editingChessGolden && goldenChessId && (
                    <Tabs.Tab value="golden">
                      精锐 <Text span size="xs" c="dimmed" ff="monospace">({goldenChessId})</Text>
                    </Tabs.Tab>
                  )}
                </Tabs.List>
                <Tabs.Panel value="normal" pt="md">
                  {editingChessNormal
                    ? <ChessStatusForm chessId={editing.chessId} isGolden={false} />
                    : <Text c="dimmed" size="sm">无 charChessDataDict 条目</Text>}
                </Tabs.Panel>
                {editingChessGolden && goldenChessId && (
                  <Tabs.Panel value="golden" pt="md">
                    <ChessStatusForm chessId={goldenChessId} isGolden={true} />
                  </Tabs.Panel>
                )}
              </Tabs>
            </Stack>
            </CollabEditingProvider>
          ) : (
            <Card withBorder padding="xl" ta="center">
              <Text c="dimmed">← 选择左侧棋子进行编辑</Text>
            </Card>
          )}
        </Grid.Col>
      </Grid>

      <Modal opened={addOpened} onClose={closeAdd} title="新增棋子" size="lg">
        <Stack gap="md">
          <SegmentedIdInput label="普通版棋子 ID" value={newChessId} onChange={changeNewId}
            labels={splitId(newChessId).length === 5 ? ['前缀', '盟约 / char', '星级', '序号', '版本'] : undefined}
            error={chessIdError ?? namingLevelError} onSubmit={addChess} />
          <Text size="xs" c="dimmed" style={{ overflowWrap: 'anywhere' }}>精锐版：{newGoldenId || '尚未填写'}（与普通版一起创建）</Text>
          <Group grow align="flex-start">
            <NumberInput label="实际星级" value={newLevel} onChange={changeNewLevel} min={1} max={6} allowDecimal={false} error={levelError} />
            <NumberInput label="商店排序" value={newSort} onChange={setNewSort} min={0} allowDecimal={false} error={sortError} />
          </Group>
          <Select label="普通版与精锐版绑定的盟约" searchable clearable placeholder="不绑定盟约"
            value={boundBond} onChange={setNewBond} data={Object.values(bondInfoDict ?? {}).map(bond => ({ value: bond.bondId, label: `${bond.name} (${bond.bondId})` }))} />
          <Group justify="space-between">
            <Text size="xs" c="dimmed">编号参照：{draftDefaults.current?.referenceId ?? '无，使用默认模板'}</Text>
            <Button size="compact-xs" variant="subtle" disabled={!!levelError} onClick={() => applySuggestion(Number(newLevel))}>重新建议</Button>
          </Group>
          <Group justify="flex-end">
            <Button variant="subtle" onClick={closeAdd}>取消</Button>
            <Button onClick={addChess} disabled={!!creationError}>创建</Button>
          </Group>
        </Stack>
      </Modal>

      <Modal opened={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="确认删除" size="sm">
        <Stack gap="md">
          <Text>确定要删除棋子 <Text span fw={700} c="red">{deleteConfirm}</Text> 吗？</Text>
          <Text size="sm" c="dimmed">同时删除对应的精锐版条目，不可撤销。</Text>
          <Group justify="flex-end">
            <Button variant="subtle" onClick={() => setDeleteConfirm(null)}>取消</Button>
            <Button color="red" onClick={() => deleteConfirm && deleteChess(deleteConfirm)}>删除</Button>
          </Group>
        </Stack>
      </Modal>
    </>
  )
}
