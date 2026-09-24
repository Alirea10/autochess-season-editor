import {
  Alert,
  Badge,
  Button,
  Card,
  Divider,
  Group,
  Grid,
  Paper,
  Progress,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
  Tooltip,
} from '@mantine/core'
import {
  IconArrowUpRight,
  IconBolt,
  IconChess,
  IconCircleCheck,
  IconGauge,
  IconHeart,
  IconListCheck,
  IconSearch,
  IconShield,
  IconShoppingCart,
  IconSparkles,
  IconUsers,
} from '@tabler/icons-react'
import {
  capacityIssues,
  difficultyLabel,
  missingSeasonReferences,
  resourceIssues,
} from '@autochess-editor/shared'
import type { ActiveModule, DataStore } from '../../store/dataStore'

interface Props { store: DataStore }

const quickColors = ['blue', 'teal', 'green', 'orange', 'violet', 'pink', 'cyan', 'indigo'] as const

function SectionHeader({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <Group justify="space-between" align="flex-start" mb="md" gap="sm">
      <div>
        <Title order={4}>{title}</Title>
        {description && <Text size="sm" c="dimmed" mt={3}>{description}</Text>}
      </div>
      {action}
    </Group>
  )
}

function Metric({ label, value, hint, color = 'teal' }: { label: string; value: string | number; hint?: string; color?: string }) {
  return (
    <Paper withBorder radius="md" p="sm" style={{ minHeight: 78 }}>
      <Text size="xs" c="dimmed">{label}</Text>
      <Text size="xl" fw={700} c={color} lh={1.1} mt={5}>{value}</Text>
      {hint && <Text size="xs" c="dimmed" mt={3}>{hint}</Text>}
    </Paper>
  )
}

export function OverviewEditor({ store }: Props) {
  const { activeSeason } = store

  if (!activeSeason) {
    return (
      <Card withBorder padding="xl" ta="center">
        <Stack align="center" gap="md">
          <Text size="xl" fw={300} c="dimmed">暂无赛季数据</Text>
          <Text size="sm" c="dimmed">请在顶部导入 JSON 文件或粘贴数据</Text>
        </Stack>
      </Card>
    )
  }

  const { data } = activeSeason
  const modes = Object.values(data.modeDataDict ?? {}).sort((a, b) => a.sortId - b.sortId)
  const bonds = Object.values(data.bondInfoDict ?? {})
    .sort((a, b) => b.chessIdList.length - a.chessIdList.length || a.identifier - b.identifier)
  const allChess = Object.values(data.charShopChessDatas ?? {})
  const visibleChess = allChess.filter(chess => !chess.isHidden)
  const hiddenChess = allChess.length - visibleChess.length
  const diyChess = visibleChess.filter(chess => chess.chessType === 'DIY').length
  const levelCounts = visibleChess.reduce<Record<number, number>>((result, chess) => {
    result[chess.chessLevel] = (result[chess.chessLevel] ?? 0) + 1
    return result
  }, {})
  const modeGroups = modes.reduce<Record<string, number>>((result, mode) => {
    result[mode.modeType] = (result[mode.modeType] ?? 0) + 1
    return result
  }, {})
  const issueCount = capacityIssues(data.constData).length
    + resourceIssues(data.runtimeConfig?.clientResources).length
    + missingSeasonReferences(data).length
  const constants = data.constData
  const isSynced = !activeSeason.isDirty && (activeSeason.fsSyncStatus === 'synced' || !activeSeason.isLocal)

  const quickEntries: Array<{ module: ActiveModule; label: string; count: number; hint: string; icon: React.ReactNode }> = [
    { module: 'modes', label: '模式', count: modes.length, hint: '玩法与难度', icon: <IconSparkles size={19} /> },
    { module: 'bonds', label: '盟约', count: Object.keys(data.bondInfoDict ?? {}).length, hint: '效果与成员', icon: <IconUsers size={19} /> },
    { module: 'chess', label: '棋子', count: visibleChess.length, hint: hiddenChess ? `${hiddenChess} 个隐藏` : '商店可见', icon: <IconChess size={19} /> },
    { module: 'traps', label: '装备', count: Object.keys(data.trapChessDataDict ?? {}).length, hint: '装备与模组', icon: <IconShield size={19} /> },
    { module: 'effects', label: '效果', count: Object.keys(data.effectInfoDataDict ?? {}).length, hint: '效果与选项', icon: <IconBolt size={19} /> },
    { module: 'garrison', label: '特质', count: Object.keys(data.garrisonDataDict ?? {}).length, hint: '触发时机', icon: <IconHeart size={19} /> },
    { module: 'buffs', label: 'Buff', count: Object.keys(data.buffTemplates ?? {}).length, hint: '模板与事件', icon: <IconListCheck size={19} /> },
    { module: 'misc:economy', label: '商店与容量', count: constants.storeCntMax, hint: '高频运行配置', icon: <IconShoppingCart size={19} /> },
  ]

  return (
    <Stack gap="lg" pb="xl">
      <Card withBorder radius="lg" padding="lg" style={{ background: 'linear-gradient(135deg, var(--mantine-color-dark-6), var(--mantine-color-dark-7))' }}>
        <Group justify="space-between" align="flex-start" gap="lg">
          <div>
            <Group gap="xs">
              <ThemeIcon variant="light" color="teal" size="lg"><IconGauge size={21} /></ThemeIcon>
              <Title order={2}>赛季工作台</Title>
            </Group>
            <Text c="dimmed" mt="xs">从最常编辑的内容开始，快速检查赛季运行基线。</Text>
          </div>
          <Group gap="xs">
            <Badge color={activeSeason.readOnly ? 'gray' : 'teal'} variant="light">{activeSeason.readOnly ? '只读' : '可编辑'}</Badge>
            <Badge color={isSynced ? 'green' : 'orange'} variant="light">{isSynced ? '已同步' : '有未保存修改'}</Badge>
          </Group>
        </Group>
        <Divider my="md" color="dark.4" />
        <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
          <Metric label="可见棋子" value={visibleChess.length} hint={hiddenChess ? `另有 ${hiddenChess} 个隐藏` : undefined} color="green" />
          <Metric label="盟约覆盖" value={bonds.reduce((sum, bond) => sum + bond.chessIdList.length, 0)} hint={`${bonds.length} 个盟约`} color="teal" />
          <Metric label="商店格子" value={constants.storeCntMax} hint={`刷新 ${constants.shopRefreshPrice} 金`} color="orange" />
          <Metric label="诊断状态" value={issueCount === 0 ? '正常' : issueCount} hint={issueCount === 0 ? '未发现明显问题' : '需要打开诊断'} color={issueCount === 0 ? 'green' : 'orange'} />
        </SimpleGrid>
      </Card>

      <Card withBorder radius="lg" padding="lg">
        <SectionHeader title="高频编辑入口" description="按实际编辑频率排列，点击卡片直接进入对应页面。" action={<Text size="xs" c="dimmed">共 {quickEntries.length} 项</Text>} />
        <SimpleGrid cols={{ base: 2, xs: 3, sm: 4 }} spacing="sm">
          {quickEntries.map((entry, index) => (
            <Card
              key={entry.module}
              withBorder
              padding="sm"
              radius="md"
              role="button"
              tabIndex={0}
              style={{ cursor: 'pointer', transition: 'border-color 120ms ease, transform 120ms ease' }}
              onClick={() => store.navigateTo(entry.module)}
              onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); store.navigateTo(entry.module) } }}
            >
              <Group justify="space-between" align="flex-start" wrap="nowrap">
                <ThemeIcon color={quickColors[index]} variant="light" size="md">{entry.icon}</ThemeIcon>
                <IconArrowUpRight size={15} color="var(--mantine-color-dimmed)" />
              </Group>
              <Text fw={600} mt="sm">{entry.label}</Text>
              <Group gap={6} align="baseline" mt={2}>
                <Text size="lg" fw={700}>{entry.count}</Text>
                <Text size="xs" c="dimmed">{entry.hint}</Text>
              </Group>
            </Card>
          ))}
        </SimpleGrid>
      </Card>

      <Grid gutter="lg">
        <Grid.Col span={{ base: 12, md: 7 }}>
          <Card withBorder radius="lg" padding="lg" h="100%">
            <SectionHeader title="模式与玩法" description={`${modes.length} 个模式，按当前排序展示。`} action={<Button variant="subtle" size="compact-sm" rightSection={<IconArrowUpRight size={15} />} onClick={() => store.navigateTo('modes')}>管理模式</Button>} />
            <Group gap="xs" mb="md">
              {Object.entries(modeGroups).map(([type, count]) => <Badge key={type} variant="light" color={type === 'MULTI' ? 'blue' : type === 'SINGLE' ? 'teal' : 'gray'}>{type} {count}</Badge>)}
            </Group>
            <Stack gap={4}>
              {modes.map(mode => (
                <Paper key={mode.modeId} withBorder p="xs" radius="sm" style={{ cursor: 'pointer' }} onClick={() => store.navigateTo('modes', mode.modeId)}>
                  <Group justify="space-between" wrap="nowrap" gap="sm">
                    <div style={{ minWidth: 0 }}>
                      <Text size="sm" fw={600} truncate>{mode.name}</Text>
                      <Text size="xs" c="dimmed" ff="monospace" truncate>{mode.code}</Text>
                    </div>
                    <Group gap={6} wrap="nowrap">
                      <Badge size="xs" color={mode.modeType === 'MULTI' ? 'blue' : mode.modeType === 'SINGLE' ? 'teal' : 'gray'}>{mode.modeType}</Badge>
                      <Badge size="xs" variant="light" color="orange">{difficultyLabel[mode.modeDifficulty] ?? mode.modeDifficulty}</Badge>
                    </Group>
                  </Group>
                </Paper>
              ))}
            </Stack>
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 5 }}>
          <Card withBorder radius="lg" padding="lg" h="100%">
            <SectionHeader title="棋子结构" description="按商店阶数查看当前可见棋子。" action={<Button variant="subtle" size="compact-sm" rightSection={<IconArrowUpRight size={15} />} onClick={() => store.navigateTo('chess')}>查看棋子</Button>} />
            <Stack gap="sm">
              {[1, 2, 3, 4, 5, 6].map(level => {
                const count = levelCounts[level] ?? 0
                const percentage = visibleChess.length ? (count / visibleChess.length) * 100 : 0
                return (
                  <div key={level}>
                    <Group justify="space-between" mb={4}>
                      <Text size="sm">{level} 阶</Text>
                      <Text size="sm" fw={600}>{count}<Text span size="xs" c="dimmed"> 个 · {percentage.toFixed(1)}%</Text></Text>
                    </Group>
                    <Progress value={percentage} color={level >= 5 ? 'orange' : 'teal'} size={7} radius="xl" />
                  </div>
                )
              })}
            </Stack>
            <Divider my="md" />
            <Group grow gap="xs">
              <Metric label="DIY" value={diyChess} hint="可见棋子" color="violet" />
              <Metric label="隐藏" value={hiddenChess} hint="仍可在棋子页查找" color="gray" />
            </Group>
          </Card>
        </Grid.Col>
      </Grid>

      <Grid gutter="lg">
        <Grid.Col span={{ base: 12, md: 7 }}>
          <Card withBorder radius="lg" padding="lg">
            <SectionHeader title="盟约覆盖" description="优先显示绑定棋子最多的盟约，方便检查成员关系。" action={<Button variant="subtle" size="compact-sm" rightSection={<IconArrowUpRight size={15} />} onClick={() => store.navigateTo('bonds')}>查看盟约</Button>} />
            <Stack gap={5}>
              {bonds.slice(0, 8).map(bond => {
                const coverage = visibleChess.length ? Math.round((bond.chessIdList.length / visibleChess.length) * 100) : 0
                return (
                  <Paper key={bond.bondId} withBorder p="xs" radius="sm" style={{ cursor: 'pointer' }} onClick={() => store.navigateTo('bonds', bond.bondId)}>
                    <Group justify="space-between" wrap="nowrap" gap="md">
                      <div style={{ minWidth: 0 }}>
                        <Text size="sm" fw={600} truncate>{bond.name || bond.bondId}</Text>
                        <Tooltip label={bond.bondId}><Text size="xs" c="dimmed" ff="monospace" truncate>{bond.bondId}</Text></Tooltip>
                      </div>
                      <Group gap="xs" wrap="nowrap">
                        <Badge size="sm" color="teal" variant="light">{bond.chessIdList.length} 棋子</Badge>
                        <Text size="xs" c="dimmed" w={38} ta="right">{coverage}%</Text>
                      </Group>
                    </Group>
                  </Paper>
                )
              })}
            </Stack>
            {bonds.length > 8 && <Text size="xs" c="dimmed" mt="sm">还有 {bonds.length - 8} 个盟约，进入盟约页查看完整列表。</Text>}
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 5 }}>
          <Card withBorder radius="lg" padding="lg" h="100%">
            <SectionHeader title="运行基线" description="战斗开始前最常检查的赛季常量。" action={<Button variant="subtle" size="compact-sm" rightSection={<IconArrowUpRight size={15} />} onClick={() => store.navigateTo('misc:economy')}>调整配置</Button>} />
            <SimpleGrid cols={2} spacing="sm">
              <Metric label="最大部署" value={constants.maxBattleChessCnt} color="blue" />
              <Metric label="最大整备区" value={constants.maxDeckChessCnt} color="cyan" />
              <Metric label="每轮扣血上限" value={constants.costPlayerHpLimit} color="red" />
              <Metric label="借用次数" value={constants.borrowCount} color="violet" />
            </SimpleGrid>
            <Paper withBorder p="sm" mt="sm" radius="md">
              <Group justify="space-between"><Text size="sm" c="dimmed">核心盟约 Ban</Text><Text fw={600}>{data.banConfig?.coreBondBanCount ?? 0}</Text></Group>
              <Group justify="space-between" mt={5}><Text size="sm" c="dimmed">小盟约 Ban</Text><Text fw={600}>{data.banConfig?.minorBondBanCount ?? 0}</Text></Group>
            </Paper>
          </Card>
        </Grid.Col>
      </Grid>

      <Alert
        variant="light"
        color={issueCount === 0 ? 'teal' : 'orange'}
        icon={issueCount === 0 ? <IconCircleCheck size={20} /> : <IconSearch size={20} />}
        title={issueCount === 0 ? '数据完整性检查通过' : `发现 ${issueCount} 项待检查内容`}
        withCloseButton={false}
      >
        <Group justify="space-between" align="center" gap="sm">
          <Text size="sm">容量、资源和跨表引用均可在诊断页集中查看，上传前建议先复核。</Text>
          <Button size="compact-sm" variant="light" color={issueCount === 0 ? 'teal' : 'orange'} onClick={() => store.navigateTo('misc:diagnostics')}>打开诊断</Button>
        </Group>
      </Alert>
    </Stack>
  )
}
