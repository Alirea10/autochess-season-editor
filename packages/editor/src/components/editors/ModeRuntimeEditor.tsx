import {
  Stack,
  Group,
  Text,
  Button,
  Card,
  Divider,
  Table,
  Alert,
} from "@mantine/core";
import { CNumberInput, CSwitch } from "../collab/CollabInputs";
import { resolveModeRuntime } from "@autochess-editor/shared";
import type {
  ModeDataDictMode,
  DifficultyScaling,
  BountyGroup,
} from "@autochess-editor/shared";

export function ModeRuntimeEditor({
  mode,
  patch,
}: {
  mode: ModeDataDictMode;
  patch: (value: Partial<ModeDataDictMode>) => void;
}) {
  const issues: string[] = [];
  const effective = resolveModeRuntime(mode, (path, message) => {
    if (message) issues.push(`${path}: ${message}`);
  });
  const scaling = effective.difficultyScaling;
  const write = (value: Partial<DifficultyScaling>) =>
    patch({ difficultyScaling: { ...mode.difficultyScaling, ...value } });
  const rows = scaling.enemyFactorsByRound;
  const groups = mode.bountyGroups;
  const writeGroup = (index: number, value: Partial<BountyGroup>) =>
    patch({
      bountyGroups: (groups ?? []).map((g, i) =>
        i === index ? { ...g, ...value } : g,
      ),
    });
  return (
    <Card withBorder>
      <Stack>
        <Group justify="space-between">
          <Text fw={600}>难度倍率</Text>
          <Button
            size="xs"
            variant="light"
            onClick={() => patch({ difficultyScaling: undefined })}
          >
            全部恢复默认
          </Button>
        </Group>
        <Text size="sm" c="dimmed">
          未覆盖字段使用当前难度的兼容值。倍率 1 为原值，0 有效。表外回合使用
          1；空表表示所有回合使用 1。
        </Text>
        {issues.map((issue, i) => (
          <Alert key={i} color="orange">
            {issue}
          </Alert>
        ))}
        <Group>
          <Button
            size="xs"
            onClick={() =>
              write({ enemyFactorsByRound: structuredClone(rows) })
            }
          >
            采用当前表并编辑
          </Button>
          <Button
            size="xs"
            variant="light"
            onClick={() => write({ enemyFactorsByRound: undefined })}
          >
            倍率表使用默认
          </Button>
          <Button
            size="xs"
            variant="light"
            onClick={() => write({ enemyFactorsByRound: [] })}
          >
            清空倍率表
          </Button>
        </Group>
        <Text size="xs">
          {mode.difficultyScaling?.enemyFactorsByRound === undefined
            ? "倍率表来源：兼容默认"
            : "倍率表来源：赛季声明"}
        </Text>
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>回合</Table.Th>
              <Table.Th>生命倍率</Table.Th>
              <Table.Th>攻击倍率</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.map((row, i) => (
              <Table.Tr key={i}>
                <Table.Td>{i + 1}</Table.Td>
                {(["maxHp", "atk"] as const).map((field) => (
                  <Table.Td key={field}>
                    <CNumberInput
                      aria-label={`第 ${i + 1} 回合 ${field}`}
                      collabField={`difficultyScaling.enemyFactorsByRound.${i}.${field}`}
                      min={0}
                      value={row[field]}
                      onChange={(v) =>
                        write({
                          enemyFactorsByRound: rows.map((r, j) =>
                            i === j ? { ...r, [field]: Number(v) } : r,
                          ),
                        })
                      }
                    />
                  </Table.Td>
                ))}
                <Table.Td>
                  <Button
                    size="xs"
                    color="red"
                    variant="subtle"
                    onClick={() =>
                      write({
                        enemyFactorsByRound: rows.filter((_, j) => j !== i),
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
        <Button
          size="xs"
          variant="light"
          onClick={() =>
            write({ enemyFactorsByRound: [...rows, { maxHp: 1, atk: 1 }] })
          }
        >
          添加回合倍率
        </Button>
        <Divider label="Boss 生命倍率" />
        {(
          [
            ["bossHpMultiplier", "基础倍率"],
            ["bossDebtBase", "每点欠血倍率"],
            ["bossDebtCap", "欠血倍率上限"],
          ] as const
        ).map(([field, label]) => (
          <Group key={field} align="end">
            <CNumberInput
              style={{ flex: 1 }}
              label={`${label}（${mode.difficultyScaling?.[field] === undefined ? "默认" : "赛季"}）`}
              collabField={`difficultyScaling.${field}`}
              min={0}
              value={scaling[field]}
              onChange={(v) => write({ [field]: Number(v) })}
            />
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
            label={`乘以玩家人数（${mode.difficultyScaling?.bossHpPerPlayer === undefined ? "默认" : "赛季"}）`}
            collabField="difficultyScaling.bossHpPerPlayer"
            checked={scaling.bossHpPerPlayer}
            onChange={(e) =>
              write({ bossHpPerPlayer: e.currentTarget.checked })
            }
          />
          <Button
            size="xs"
            variant="subtle"
            onClick={() => write({ bossHpPerPlayer: undefined })}
          >
            默认
          </Button>
        </Group>
        <Text size="xs" c="dimmed">
          最终生命 = Boss 对应难度生命 × 基础倍率 × 人数项 × min(每点欠血倍率 ^
          总欠血, 欠血倍率上限)。
        </Text>
        <Divider label="悬赏候选分组" />
        <Text size="sm">
          自动从 ENEMY_GAIN
          的有效生成效果读取。可用价格和回合划分候选，不需要维护效果
          ID。分组数量为优先抽取数，余位从当前有效分组补齐并去重；数量 0
          停用该组。
        </Text>
        <Group>
          <Button
            size="xs"
            variant="light"
            onClick={() => patch({ bountyGroups: undefined })}
          >
            恢复自动候选
          </Button>
          <Button
            size="xs"
            variant="light"
            onClick={() => patch({ bountyGroups: [] })}
          >
            禁用悬赏候选
          </Button>
          <Button
            size="xs"
            onClick={() =>
              patch({ bountyGroups: [...(groups ?? []), { count: 1 }] })
            }
          >
            添加分组
          </Button>
        </Group>
        <Text size="xs">
          {groups === undefined
            ? "自动读取全部有效候选"
            : groups.length
              ? "使用赛季分组"
              : "明确为空：不提供候选"}
        </Text>
        {(groups ?? []).map((g, i) => (
          <Card withBorder key={i}>
            <Group>
              {(
                [
                  ["minRound", "起始回合"],
                  ["maxRound", "结束回合"],
                  ["minPrice", "最低价格"],
                  ["maxPrice", "最高价格"],
                  ["count", "优先数量"],
                ] as const
              ).map(([field, label]) => (
                <CNumberInput
                  key={field}
                  w={120}
                  label={label}
                  placeholder="不限"
                  min={0}
                  allowDecimal={field.includes("Price")}
                  value={g[field] ?? ""}
                  collabField={`bountyGroups.${i}.${field}`}
                  onChange={(v) =>
                    writeGroup(i, {
                      [field]:
                        v === ""
                          ? field === "count"
                            ? 0
                            : undefined
                          : Number(v),
                    })
                  }
                />
              ))}
              <Button
                size="xs"
                color="red"
                variant="subtle"
                onClick={() =>
                  patch({ bountyGroups: groups!.filter((_, j) => i !== j) })
                }
              >
                删除组
              </Button>
            </Group>
          </Card>
        ))}
      </Stack>
    </Card>
  );
}
