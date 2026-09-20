import {
  Alert,
  Button,
  Code,
  Divider,
  Group,
  ScrollArea,
  Stack,
  Table,
  Text,
} from '@mantine/core'
import { CNumberInput, CSwitch } from '../collab/CollabInputs'
import {
  defaultEnemyGrowth,
  enemyFactorsAtRound,
  resolveModeRuntime,
} from '@autochess-editor/shared'
import type {
  DifficultyScaling,
  EnemyGrowth,
  ModeDataDictMode,
} from '@autochess-editor/shared'

const isRecord = (v: unknown): v is Record<string, any> =>
  !!v && typeof v === 'object' && !Array.isArray(v)
const displayNumber = (v: unknown) =>
  typeof v === 'number' || typeof v === 'string' ? v : ''
const growthFields = [
  ['maxHpExponent', '生命指数'],
  ['maxHpMultiplier', '生命乘数'],
  ['atkExponent', '攻击指数'],
  ['atkMultiplier', '攻击乘数'],
  ['moveSpeed', '移速倍率'],
] as const
const identityRow = {
  maxHpExponent: 0,
  atkExponent: 0,
  maxHpMultiplier: 1,
  atkMultiplier: 1,
  moveSpeed: 1,
}

export function DifficultyScalingEditor({
  mode,
  patch,
}: {
  mode: ModeDataDictMode
  patch: (value: Partial<ModeDataDictMode>) => void
}) {
  const issues: string[] = []
  const sources: Record<string, string> = {}
  const effective = resolveModeRuntime(mode, (path, message, source) => {
    if (!path.includes('.difficultyScaling')) return
    sources[path] = source
    if (message) issues.push(`${path}: ${message}`)
  }).difficultyScaling
  const raw = isRecord(mode.difficultyScaling) ? mode.difficultyScaling : {}
  const write = (value: Partial<DifficultyScaling>) =>
    patch({ difficultyScaling: { ...raw, ...value } })
  const direct = raw.enemyFactorsByRound !== undefined
  const growth: EnemyGrowth =
    raw.enemyGrowth === undefined
      ? defaultEnemyGrowth(mode.modeDifficulty)
      : raw.enemyGrowth
  const growthRows =
    isRecord(growth) && Array.isArray(growth.rounds) ? growth.rounds : []
  const directRows = Array.isArray(raw.enemyFactorsByRound)
    ? raw.enemyFactorsByRound
    : []
  const writeGrowth = (value: Partial<EnemyGrowth>) =>
    write({
      enemyFactorsByRound: undefined,
      enemyGrowth: {
        ...(isRecord(growth) ? growth : {}),
        ...value,
      } as EnemyGrowth,
    })
  const sourceLabel = (field: string) =>
    sources[`modeDataDict.${mode.modeId}.difficultyScaling.${field}`] ===
    'season'
      ? '赛季声明'
      : '服务器默认'

  return (
    <Stack>
      <Group justify="space-between">
        <Text fw={600}>难度数值</Text>
        <Button
          size="xs"
          variant="light"
          onClick={() => patch({ difficultyScaling: undefined })}
        >
          全部恢复默认
        </Button>
      </Group>
      <Text size="sm" c="dimmed">
        未声明项使用服务器默认值；任意难度字段错误时，本模式整套数值回退。公式为底数
        ^ 指数 × 乘数，血攻结果保留三位小数。生命、攻击用于非
        Boss；移速用于全部敌人。
      </Text>
      {issues.length > 0 && (
        <Alert color="orange" title="本模式整套难度数值使用默认值">
          {issues.map((issue, i) => (
            <Text size="xs" key={i}>
              {issue}
            </Text>
          ))}
          <Text size="sm" mt="xs">
            以下是原始声明，修正输入或恢复默认前不会覆盖：
          </Text>
          <Code block>{JSON.stringify(mode.difficultyScaling, null, 2)}</Code>
        </Alert>
      )}
      <Group>
        <Button
          size="xs"
          onClick={() =>
            write({
              enemyFactorsByRound: undefined,
              enemyGrowth:
                direct && !issues.length
                  ? {
                      maxHpBase: 1,
                      atkBase: 1,
                      rounds: directRows.map((row) => ({
                        ...identityRow,
                        maxHpMultiplier: row.maxHp,
                        atkMultiplier: row.atk,
                        moveSpeed: row.moveSpeed ?? 1,
                      })),
                    }
                  : defaultEnemyGrowth(mode.modeDifficulty),
            })
          }
        >
          {direct ? '转换为公式（末行将延续）' : '采用默认公式'}
        </Button>
        <Button
          size="xs"
          variant="light"
          onClick={() =>
            write({
              enemyGrowth: undefined,
              enemyFactorsByRound: structuredClone(
                effective.enemyFactorsByRound,
              ),
            })
          }
        >
          转为最终倍率表
        </Button>
        <Button
          size="xs"
          variant="subtle"
          onClick={() =>
            write({ enemyGrowth: undefined, enemyFactorsByRound: undefined })
          }
        >
          敌人数值恢复默认
        </Button>
      </Group>
      <Text size="xs">
        当前生效来源：{sourceLabel('enemyFactorsByRound')}。
        {direct ? '最终倍率表外回合使用 1。' : '自定义公式表外沿用末行。'}
        空表表示全部倍率为 1。
      </Text>
      {!direct && (
        <>
          <Group grow>
            {(
              [
                ['maxHpBase', '生命底数'],
                ['atkBase', '攻击底数'],
              ] as const
            ).map(([field, label]) => (
              <CNumberInput
                key={field}
                label={label}
                collabField={`difficultyScaling.enemyGrowth.${field}`}
                value={displayNumber(growth?.[field])}
                clampBehavior="none"
                onChange={(v) =>
                  writeGrowth({ [field]: v } as Partial<EnemyGrowth>)
                }
              />
            ))}
          </Group>
          <ScrollArea>
            <Table miw={680}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>回合</Table.Th>
                  {growthFields.map(([f, l]) => (
                    <Table.Th key={f}>{l}</Table.Th>
                  ))}
                  <Table.Th />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {growthRows.map((row, i) => (
                  <Table.Tr key={i}>
                    <Table.Td>W{i + 1}</Table.Td>
                    {growthFields.map(([field, label]) => (
                      <Table.Td key={field}>
                        <CNumberInput
                          aria-label={`W${i + 1} ${label}`}
                          collabField={`difficultyScaling.enemyGrowth.rounds.${i}.${field}`}
                          value={displayNumber(row?.[field])}
                          clampBehavior="none"
                          w={105}
                          onChange={(v) =>
                            writeGrowth({
                              rounds: growthRows.map((r, j) =>
                                i === j
                                  ? { ...(isRecord(r) ? r : {}), [field]: v }
                                  : r,
                              ) as EnemyGrowth['rounds'],
                            })
                          }
                        />
                      </Table.Td>
                    ))}
                    <Table.Td>
                      <Button
                        size="xs"
                        variant="subtle"
                        color="red"
                        onClick={() =>
                          writeGrowth({
                            rounds: growthRows.filter((_, j) => i !== j),
                          })
                        }
                      >
                        删除
                      </Button>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </ScrollArea>
          <Group>
            <Button
              size="xs"
              variant="light"
              onClick={() =>
                writeGrowth({ rounds: [...growthRows, { ...identityRow }] })
              }
            >
              添加回合
            </Button>
            <Button
              size="xs"
              variant="subtle"
              onClick={() => writeGrowth({ rounds: [] })}
            >
              清空公式回合表
            </Button>
          </Group>
        </>
      )}
      {direct && (
        <>
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>回合</Table.Th>
                <Table.Th>生命倍率</Table.Th>
                <Table.Th>攻击倍率</Table.Th>
                <Table.Th>移速倍率</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {directRows.map((row, i) => (
                <Table.Tr key={i}>
                  <Table.Td>W{i + 1}</Table.Td>
                  {(['maxHp', 'atk', 'moveSpeed'] as const).map((field) => (
                    <Table.Td key={field}>
                      <CNumberInput
                        aria-label={`W${i + 1} ${field}`}
                        collabField={`difficultyScaling.enemyFactorsByRound.${i}.${field}`}
                        value={displayNumber(
                          row?.[field] === undefined && field === 'moveSpeed'
                            ? 1
                            : row?.[field],
                        )}
                        clampBehavior="none"
                        onChange={(v) =>
                          write({
                            enemyFactorsByRound: directRows.map((r, j) =>
                              i === j
                                ? { ...(isRecord(r) ? r : {}), [field]: v }
                                : r,
                            ) as DifficultyScaling['enemyFactorsByRound'],
                          })
                        }
                      />
                    </Table.Td>
                  ))}
                  <Table.Td>
                    <Button
                      size="xs"
                      variant="subtle"
                      color="red"
                      onClick={() =>
                        write({
                          enemyFactorsByRound: directRows.filter(
                            (_, j) => i !== j,
                          ),
                        })
                      }
                    >
                      删除
                    </Button>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
          <Group>
            <Button
              size="xs"
              variant="light"
              onClick={() =>
                write({
                  enemyFactorsByRound: [
                    ...directRows,
                    { maxHp: 1, atk: 1, moveSpeed: 1 },
                  ],
                })
              }
            >
              添加回合
            </Button>
            <Button
              size="xs"
              variant="subtle"
              onClick={() => write({ enemyFactorsByRound: [] })}
            >
              清空最终倍率表
            </Button>
          </Group>
        </>
      )}
      <Divider label="Boss 独立生命配置" />
      {(
        [
          ['bossHpMultiplier', '基础倍率'],
          ['bossDebtBase', '每点欠血倍率'],
          ['bossDebtCap', '欠血倍率上限'],
        ] as const
      ).map(([field, label]) => (
        <Group key={field} align="end">
          <CNumberInput
            style={{ flex: 1 }}
            label={label}
            collabField={`difficultyScaling.${field}`}
            value={displayNumber(
              raw[field] === undefined ? effective[field] : raw[field],
            )}
            clampBehavior="none"
            onChange={(v) =>
              write({ [field]: v } as Partial<DifficultyScaling>)
            }
          />
          <Text size="xs">
            生效：{effective[field]}（{sourceLabel(field)}）
          </Text>
          <Button
            size="xs"
            variant="subtle"
            onClick={() => write({ [field]: undefined })}
          >
            默认
          </Button>
        </Group>
      ))}
      <Group>
        <CSwitch
          label="乘以玩家人数"
          collabField="difficultyScaling.bossHpPerPlayer"
          checked={
            raw.bossHpPerPlayer === undefined
              ? effective.bossHpPerPlayer
              : raw.bossHpPerPlayer === true
          }
          onChange={(e) => write({ bossHpPerPlayer: e.currentTarget.checked })}
        />
        <Text size="xs">
          生效：{effective.bossHpPerPlayer ? '是' : '否'}（
          {sourceLabel('bossHpPerPlayer')}）
        </Text>
        <Button
          size="xs"
          variant="subtle"
          onClick={() => write({ bossHpPerPlayer: undefined })}
        >
          默认
        </Button>
      </Group>
      <Text size="xs" c="dimmed">
        Boss 生命 = 对应基础难度生命 × 基础倍率 × 人数项 × min(每点欠血倍率 ^
        总欠血, 欠血倍率上限)。
      </Text>
      <Divider label="最终生效倍率预览" />
      <Text size="xs" c="dimmed">
        预览不会写入赛季。W15
        为当前隐藏回合；表外预览用于检查延续规则。连接目标服务器后的完整诊断结果为准。
      </Text>
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>回合</Table.Th>
            <Table.Th>生命</Table.Th>
            <Table.Th>攻击</Table.Th>
            <Table.Th>移速</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {Array.from(
            { length: Math.max(16, effective.enemyFactorsByRound.length + 1) },
            (_, i) => {
              const row = enemyFactorsAtRound(effective, i + 1)
              return (
                <Table.Tr key={i}>
                  <Table.Td>
                    W{i + 1}
                    {i === 14 ? '（隐藏）' : ''}
                  </Table.Td>
                  <Table.Td>{row.maxHp}</Table.Td>
                  <Table.Td>{row.atk}</Table.Td>
                  <Table.Td>{row.moveSpeed ?? 1}</Table.Td>
                </Table.Tr>
              )
            },
          )}
        </Table.Tbody>
      </Table>
    </Stack>
  )
}
