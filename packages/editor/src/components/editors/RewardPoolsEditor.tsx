import { useState } from 'react'
import {
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Grid,
  Group,
  ScrollArea,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import {
  equipmentLevelPoolRule,
  inspectRewardPools,
  REWARD_POOL_RECIPES,
  rewardPoolCandidates,
  rewardPoolRuleIssues,
  findSeasonReferences,
} from '@autochess-editor/shared'
import type { RewardPool, RewardPoolRule } from '@autochess-editor/shared'
import {
  CTextInput,
  CNumberInput,
  CSelect,
  CMultiSelect,
  CollabEditingProvider,
} from '../collab/CollabInputs'
import type { DataStore } from '../../store/dataStore'

const kindLabels = { char: '干员', equip: '装备', magic: '法术' }

export function RuntimeRewardPoolsEditor({ store }: { store: DataStore }) {
  const [name, setName] = useState('')
  const [selected, setSelected] = useState('pool_chess_glady')
  const [search, setSearch] = useState('')
  if (!store.activeSeason) return null
  const data = store.activeSeason.data
  const state = inspectRewardPools(data)
  const declared = data.runtimeConfig?.rewardPools ?? {}
  const rules = data.runtimeConfig?.rewardPoolRules ?? {}
  const ids = [
    ...new Set([
      ...Object.keys(REWARD_POOL_RECIPES),
      ...Object.keys(declared),
      ...Object.keys(rules),
      ...state.references.map((r) => r.id),
    ]),
  ]
  const id = ids.includes(selected) ? selected : ids[0]
  const builtin = Object.hasOwn(REWARD_POOL_RECIPES, id)
  const hasRule = Object.hasOwn(rules, id)
  const hasOverride = hasRule || Object.hasOwn(declared, id)
  const ruleIssues = rewardPoolRuleIssues(data)
  const invalidRule =
    hasRule &&
    ruleIssues.some(
      (i) =>
        i.path === 'runtimeConfig.rewardPoolRules' ||
        i.path === `runtimeConfig.rewardPoolRules.${id}` ||
        i.path.startsWith(`runtimeConfig.rewardPoolRules.${id}.`),
    )
  const rule = hasRule && !invalidRule ? rules[id] : undefined
  const candidateList = rewardPoolCandidates(data)
  const candidates = new Map(candidateList.map((c) => [c.id, c]))
  const goods = candidateList.map((c) => ({
    value: c.id,
    label: `${c.name}${c.golden ? '（金色）' : ''} · ${kindLabels[c.kind]} · ${c.id}`,
  }))
  const rawEntries = state.compiled.runtimeConfig?.rewardPools?.[id]
  const entries = Array.isArray(rawEntries) ? rawEntries : []
  const effective = state.pools[id] ?? []
  const total = effective.reduce((n, e) => n + e.value, 0)
  const status = (poolId: string) => {
    const overridden = Object.hasOwn(declared, poolId) || Object.hasOwn(rules, poolId)
    if (!state.pools[poolId]?.some((e) => e.value > 0)) return '无可用候选'
    return state.sources[`runtimeConfig.rewardPools.${poolId}`] === 'season'
      ? '赛季覆盖'
      : overridden
        ? '回退默认'
        : '服务器默认'
  }
  const write = (poolId: string, list: RewardPool | undefined, recipe?: RewardPoolRule) => {
    store.updateSeason(store.activeSeasonId!, (d) => {
      const nextPools = { ...d.runtimeConfig?.rewardPools },
        nextRules = { ...d.runtimeConfig?.rewardPoolRules }
      delete nextPools[poolId]
      delete nextRules[poolId]
      if (list !== undefined)
        Object.defineProperty(nextPools, poolId, {
          value: list,
          enumerable: true,
          writable: true,
          configurable: true,
        })
      if (recipe)
        Object.defineProperty(nextRules, poolId, {
          value: recipe,
          enumerable: true,
          writable: true,
          configurable: true,
        })
      return {
        ...d,
        runtimeConfig: {
          ...d.runtimeConfig,
          version: 1,
          rewardPools: nextPools,
          rewardPoolRules: nextRules,
        },
      }
    })
  }
  const patchRule = (patch: Partial<RewardPoolRule>) => {
    if (rule) write(id, entries, { ...rule, ...patch })
  }
  const remove = () => {
    const current = store.getSeason(store.activeSeasonId!)?.data ?? data
    const refs = findSeasonReferences(current, id, [
      `runtimeConfig.rewardPools.${id}`,
      `runtimeConfig.rewardPoolRules.${id}`,
    ])
    if (!builtin && refs.length) {
      notifications.show({ title: '仍被引用，未删除', message: refs.join('；'), color: 'orange' })
      return
    }
    write(id, undefined)
  }
  const create = (dynamic: boolean) => {
    const poolId = name.trim()
    if (
      !poolId ||
      Object.hasOwn(REWARD_POOL_RECIPES, poolId) ||
      Object.hasOwn(declared, poolId) ||
      Object.hasOwn(rules, poolId)
    )
      return
    write(poolId, [], dynamic ? equipmentLevelPoolRule() : undefined)
    setSelected(poolId)
    setName('')
  }
  const nameTaken =
    !name.trim() ||
    Object.hasOwn(REWARD_POOL_RECIPES, name.trim()) ||
    Object.hasOwn(declared, name.trim()) ||
    Object.hasOwn(rules, name.trim())
  const issues = state.issues.filter(
    (i) =>
      i.path === 'runtimeConfig.rewardPools' ||
      i.path === 'runtimeConfig.rewardPoolRules' ||
      i.path === `runtimeConfig.rewardPools.${id}` ||
      i.path.startsWith(`runtimeConfig.rewardPools.${id}.`) ||
      i.path === `runtimeConfig.rewardPoolRules.${id}` ||
      i.path.startsWith(`runtimeConfig.rewardPoolRules.${id}.`),
  )
  const levels = [
    ...new Set([
      ...candidateList.flatMap((c) => (c.level === undefined ? [] : [c.level])),
      ...(rule?.levels ?? []),
    ]),
  ]
    .sort((a, b) => a - b)
    .map((v) => ({ value: String(v), label: `${v} 级` }))

  return (
    <Stack gap="sm">
      <Group justify="space-between">
        <Title order={5}>局内奖励池</Title>
        <Badge variant="light">14 个内置池 · {Object.keys(declared).length} 个赛季声明</Badge>
      </Group>
      <Text size="sm" c="dimmed">
        赛季同名池优先。未声明、空池或无有效正权重候选时回退同名默认池。规则随赛季数据更新，保存或导出时生成名单。
      </Text>
      <Group align="end">
        <CTextInput
          label="新池名"
          value={name}
          placeholder="pool_equip_shop_3_reward"
          onChange={(e) => setName(e.currentTarget.value)}
        />
        <Button disabled={nameTaken} onClick={() => create(false)}>
          新建固定名单
        </Button>
        <Button disabled={nameTaken} variant="light" onClick={() => create(true)}>
          新建指定等级装备池
        </Button>
      </Group>
      <Grid>
        <Grid.Col span={{ base: 12, md: 4 }}>
          <CTextInput
            label="搜索池名"
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
          />
          <ScrollArea.Autosize mah={530} mt="sm">
            <Stack gap={4}>
              {ids
                .filter((x) => x.includes(search))
                .map((poolId) => (
                  <Button
                    key={poolId}
                    variant={poolId === id ? 'light' : 'subtle'}
                    fullWidth
                    h="auto"
                    py={8}
                    onClick={() => setSelected(poolId)}
                    styles={{
                      label: {
                        display: 'block',
                        width: '100%',
                        textAlign: 'left',
                        whiteSpace: 'normal',
                        overflowWrap: 'anywhere',
                      },
                    }}
                  >
                    <Text size="xs" fw={600}>
                      {poolId}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {status(poolId)} · {state.pools[poolId]?.length ?? 0} 个候选
                    </Text>
                  </Button>
                ))}
            </Stack>
          </ScrollArea.Autosize>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 8 }}>
          <CollabEditingProvider itemId={`reward-pool:${id}`}>
            <Card withBorder>
              <Stack gap="sm">
                <Group justify="space-between">
                  <Text fw={600} style={{ overflowWrap: 'anywhere' }}>
                    {id}
                  </Text>
                  <Badge>{status(id)}</Badge>
                </Group>
                {builtin && <Text size="sm">默认配方：{REWARD_POOL_RECIPES[id]}</Text>}
                {id === 'pool_equip_shop_1' && (
                  <Alert color="blue">
                    服务器默认及回退状态保留原入口的库存抽取；有效的赛季覆盖使用声明权重。
                  </Alert>
                )}
                <Group gap="xs">
                  {!hasOverride && (
                    <Button
                      size="xs"
                      onClick={() =>
                        write(id, Object.hasOwn(state.defaults, id) ? state.defaults[id] : [])
                      }
                    >
                      复制为赛季固定名单
                    </Button>
                  )}
                  {!rule && (
                    <Button
                      size="xs"
                      variant="light"
                      onClick={() => write(id, [], equipmentLevelPoolRule())}
                    >
                      {hasOverride ? '改为指定等级装备规则' : '使用指定等级装备规则覆盖'}
                    </Button>
                  )}
                  {rule && (
                    <Button size="xs" variant="light" onClick={() => write(id, entries)}>
                      转为当前固定名单
                    </Button>
                  )}
                  {hasOverride && (
                    <Button size="xs" color="red" variant="subtle" onClick={remove}>
                      {builtin ? '移除覆盖 / 恢复默认' : '删除自定义池'}
                    </Button>
                  )}
                </Group>
                {invalidRule && (
                  <Alert color="red">
                    规则格式无效，保存或导出前请修复。可重新选择“指定等级装备规则”，或移除覆盖。
                    {ruleIssues
                      .filter((i) => i.path.includes(id))
                      .map((i) => (
                        <Text key={i.path} size="xs">
                          {i.path}：{i.message}
                        </Text>
                      ))}
                  </Alert>
                )}
                {rule && (
                  <>
                    <Grid>
                      <Grid.Col span={6}>
                        <CSelect
                          label="候选来源"
                          data={[
                            { value: 'shop', label: '商店条目' },
                            { value: 'all', label: '全部实体' },
                          ]}
                          value={rule.source}
                          onChange={(v) => patchRule({ source: v as RewardPoolRule['source'] })}
                          allowDeselect={false}
                        />
                      </Grid.Col>
                      <Grid.Col span={6}>
                        <CSelect
                          label="类型"
                          data={[
                            { value: 'char', label: '干员' },
                            { value: 'equip', label: '装备' },
                            { value: 'magic', label: '法术' },
                            { value: 'all', label: '全部类型' },
                          ]}
                          value={rule.kind}
                          onChange={(v) =>
                            patchRule({
                              kind: v as RewardPoolRule['kind'],
                              bondIds: v === 'char' ? rule.bondIds : [],
                            })
                          }
                          allowDeselect={false}
                        />
                      </Grid.Col>
                      <Grid.Col span={6}>
                        <CSelect
                          label="品质"
                          data={[
                            { value: 'normal', label: '普通' },
                            { value: 'golden', label: '金色' },
                            { value: 'all', label: '普通与金色' },
                          ]}
                          value={rule.quality}
                          onChange={(v) => patchRule({ quality: v as RewardPoolRule['quality'] })}
                          allowDeselect={false}
                        />
                      </Grid.Col>
                      <Grid.Col span={6}>
                        <CSelect
                          label="隐藏状态"
                          data={[
                            { value: 'visible', label: '非隐藏商店条目' },
                            { value: 'hidden', label: '隐藏商店条目' },
                            { value: 'all', label: '不限（含未上架）' },
                          ]}
                          value={rule.visibility}
                          onChange={(v) =>
                            patchRule({ visibility: v as RewardPoolRule['visibility'] })
                          }
                          allowDeselect={false}
                        />
                      </Grid.Col>
                      <Grid.Col span={6}>
                        <CMultiSelect
                          label="等级（留空不限）"
                          data={levels}
                          value={rule.levels.map(String)}
                          onChange={(v) => patchRule({ levels: v.map(Number) })}
                        />
                      </Grid.Col>
                      <Grid.Col span={6}>
                        <CNumberInput
                          label="默认权重"
                          min={0}
                          value={rule.weight}
                          onChange={(v) => patchRule({ weight: Number(v) })}
                        />
                      </Grid.Col>
                    </Grid>
                    {rule.kind === 'char' && (
                      <CMultiSelect
                        label="盟约（任一匹配，留空不限）"
                        searchable
                        data={[
                          ...new Set([...Object.keys(data.bondInfoDict), ...rule.bondIds]),
                        ].map((b) => ({
                          value: b,
                          label: `${data.bondInfoDict[b]?.name ?? b} · ${b}`,
                        }))}
                        value={rule.bondIds}
                        onChange={(v) => patchRule({ bondIds: v })}
                      />
                    )}
                    <CMultiSelect
                      label="排除候选"
                      searchable
                      data={[
                        ...goods,
                        ...rule.excludeIds
                          .filter((x) => !candidates.has(x))
                          .map((x) => ({ value: x, label: x })),
                      ]}
                      value={rule.excludeIds}
                      onChange={(v) => patchRule({ excludeIds: v })}
                    />
                    <Text size="xs" c="dimmed">
                      筛选条件同时满足；等级和盟约的多选值任一匹配。修改下方候选权重可覆盖默认值。
                    </Text>
                  </>
                )}
                {hasOverride && !invalidRule && (
                  <>
                    <Text size="sm" fw={600}>
                      {rule ? '规则生成名单' : '固定名单'} · {entries.length} 个条目
                    </Text>
                    <ScrollArea.Autosize mah={300}>
                      <Stack gap={6}>
                        {entries.map((entry, index) => (
                          <Group key={`${index}:${entry?.chessId}`} wrap="nowrap" align="end">
                            <Box style={{ flex: 1, minWidth: 0 }}>
                              {rule ? (
                                <Text size="xs">
                                  {goods.find((g) => g.value === entry.chessId)?.label ??
                                    entry.chessId}
                                </Text>
                              ) : (
                                <CSelect
                                  label={`候选 ${index + 1}`}
                                  searchable
                                  data={
                                    candidates.has(entry?.chessId)
                                      ? goods
                                      : [
                                          ...goods,
                                          {
                                            value: entry?.chessId || '__missing__',
                                            label: entry?.chessId || '无效 ID',
                                          },
                                        ]
                                  }
                                  value={entry?.chessId || '__missing__'}
                                  onChange={(v) =>
                                    write(
                                      id,
                                      entries.map((e, i) =>
                                        i === index ? { ...e, chessId: v ?? '' } : e,
                                      ),
                                    )
                                  }
                                  allowDeselect={false}
                                />
                              )}
                            </Box>
                            <CNumberInput
                              label="权重"
                              collabField={`weight:${index}`}
                              w={100}
                              min={0}
                              value={entry?.value ?? 0}
                              onChange={(v) =>
                                rule
                                  ? patchRule({
                                      weightOverrides: {
                                        ...rule.weightOverrides,
                                        [entry.chessId]: Number(v),
                                      },
                                    })
                                  : write(
                                      id,
                                      entries.map((e, i) =>
                                        i === index ? { ...e, value: Number(v) } : e,
                                      ),
                                    )
                              }
                            />
                            <Button
                              size="xs"
                              variant="subtle"
                              onClick={() => {
                                if (rule) {
                                  const next = { ...rule.weightOverrides }
                                  delete next[entry.chessId]
                                  patchRule({ weightOverrides: next })
                                } else
                                  write(
                                    id,
                                    entries.filter((_, i) => i !== index),
                                  )
                              }}
                            >
                              {rule ? '重置权重' : '删除'}
                            </Button>
                          </Group>
                        ))}
                      </Stack>
                    </ScrollArea.Autosize>
                    {!rule && (
                      <Button
                        size="xs"
                        variant="light"
                        disabled={!goods.length}
                        onClick={() =>
                          write(id, [...entries, { chessId: goods[0].value, value: 1 }])
                        }
                      >
                        添加候选
                      </Button>
                    )}
                  </>
                )}
                {issues.length > 0 && (
                  <Alert color="orange">
                    {issues.map((i, n) => (
                      <Text size="xs" key={n}>
                        {i.path}：{i.message}
                      </Text>
                    ))}
                  </Alert>
                )}
                <Text size="sm" fw={600}>
                  实际候选预览 · {effective.length} 个条目
                </Text>
                <Text size="xs" c="dimmed">
                  按权重独立抽取，可重复。默认库存池及调用方的额外筛选可能改变实际概率。
                </Text>
                <ScrollArea.Autosize mah={260}>
                  <Table striped>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>候选 / ID</Table.Th>
                        <Table.Th>权重</Table.Th>
                        <Table.Th>概率</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {effective.map((e, i) => (
                        <Table.Tr key={i}>
                          <Table.Td>
                            <Text size="xs">
                              {candidates.get(e.chessId)?.name ?? e.chessId}
                              {candidates.get(e.chessId)?.golden ? '（金色）' : ''}
                            </Text>
                            <Text size="xs" c="dimmed">
                              {e.chessId}
                            </Text>
                          </Table.Td>
                          <Table.Td>{e.value}</Table.Td>
                          <Table.Td>
                            {total > 0 ? `${((e.value / total) * 100).toFixed(2)}%` : '0%'}
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </ScrollArea.Autosize>
                <Text size="sm" fw={600}>
                  引用位置
                </Text>
                {state.references
                  .filter((r) => r.id === id)
                  .map((r) => (
                    <Button
                      key={r.path}
                      variant="subtle"
                      size="compact-xs"
                      justify="start"
                      onClick={() => {
                        const parts = r.path.split('.')
                        store.navigateTo(
                          parts[0] === 'garrisonDataDict' ? 'garrison' : 'effects',
                          parts[1],
                        )
                      }}
                    >
                      {r.path}
                    </Button>
                  ))}
                {!state.references.some((r) => r.id === id) && (
                  <Text size="xs" c="dimmed">
                    当前没有显式引用
                  </Text>
                )}
              </Stack>
            </Card>
          </CollabEditingProvider>
        </Grid.Col>
      </Grid>
    </Stack>
  )
}
