import {
  Card,
  Stack,
  Group,
  Text,
  Button,
  Table,
  Divider,
  Alert,
} from "@mantine/core";
import { CNumberInput } from "../collab/CollabInputs";
import {
  resolveEconomyRuntime,
  capacityIssues,
} from "@autochess-editor/shared";
import type { DataStore } from "../../store/dataStore";

export function EconomyEditor({ store }: { store: DataStore }) {
  if (!store.activeSeason) return null;
  const data = store.activeSeason.data,
    runtime = data.runtimeConfig;
  const messages: string[] = [];
  const effective = resolveEconomyRuntime(runtime, (path, message) => {
    if (message) messages.push(`${path}: ${message}`);
  });
  const patch = (section: "shop" | "economy", key: string, value: unknown) =>
    store.updateSeason(store.activeSeasonId!, (d) => ({
      ...d,
      runtimeConfig: {
        ...d.runtimeConfig,
        version: 1,
        [section]: { ...d.runtimeConfig?.[section], [key]: value },
      },
    }));
  const difficulties = [
    ...new Set(Object.values(data.modeDataDict).map((m) => m.modeDifficulty)),
  ];
  return (
    <Stack>
      <Text fw={600}>局内经济、商店与容量</Text>
      <Text size="sm">
        缺省使用兼容默认值；显式
        0、空表和空字典保留。概率行作为当前抽样算法的阶级权重，不要求合计
        100%。局外结算奖励不参与这里的金币计算。
      </Text>
      {messages.map((m, i) => (
        <Alert color="orange" key={i}>
          {m}
        </Alert>
      ))}
      {capacityIssues(data.constData).map((issue) => (
        <Alert key={issue.path} color="red">
          {issue.path}: {issue.message}
        </Alert>
      ))}
      <Group align="end">
        {(
          [
            ["shopRefreshPrice", "刷新费用"],
            ["maxBattleChessCnt", "部署上限"],
            ["maxDeckChessCnt", "备战容量"],
            ["storeCntMax", "商店总容量"],
            ["costPlayerHpLimit", "单场扣血上限"],
          ] as const
        ).map(([key, label]) => (
          <CNumberInput
            w={150}
            key={key}
            label={label}
            min={0}
            allowDecimal={false}
            value={data.constData[key]}
            collabField={`constData.${key}`}
            onChange={(v) =>
              store.updateSeason(store.activeSeasonId!, (d) => ({
                ...d,
                constData: { ...d.constData, [key]: Number(v) },
              }))
            }
          />
        ))}
      </Group>
      <Text size="xs" c="dimmed">
        商店商品数仍读取模式等级表，并受总容量约束。备战区满时购买受限，额外奖励保留至腾出空位。
      </Text>
      {(["charRates", "equipRates"] as const).map((key) => {
        const rows = effective.shop[key];
        return (
          <Card key={key} withBorder>
            <Stack gap="xs">
              <Group>
                <Text fw={600}>
                  {key === "charRates" ? "棋子" : "装备"}阶级权重
                </Text>
                <Text size="xs">
                  {runtime?.shop?.[key] === undefined ? "默认" : "赛季声明"}
                </Text>
                <Button
                  size="xs"
                  variant="light"
                  onClick={() => patch("shop", key, undefined)}
                >
                  使用默认
                </Button>
                <Button
                  size="xs"
                  variant="light"
                  onClick={() => patch("shop", key, [])}
                >
                  明确为空
                </Button>
              </Group>
              <Table>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>商店等级</Table.Th>
                    {Array.from({ length: 6 }, (_, i) => (
                      <Table.Th key={i}>{i + 1} 阶</Table.Th>
                    ))}
                    <Table.Th />
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {rows.map((row, i) => (
                    <Table.Tr key={i}>
                      <Table.Td>{i + 1}</Table.Td>
                      {Array.from(
                        { length: Math.max(6, row.length) },
                        (_, j) => (
                          <Table.Td key={j}>
                            <CNumberInput
                              w={80}
                              min={0}
                              aria-label={`${key} 等级 ${i + 1} 阶 ${j + 1}`}
                              value={row[j] ?? 0}
                              onChange={(v) =>
                                patch(
                                  "shop",
                                  key,
                                  rows.map((r, n) =>
                                    n === i
                                      ? Array.from(
                                          { length: Math.max(j + 1, r.length) },
                                          (_, col) =>
                                            col === j
                                              ? Number(v)
                                              : (r[col] ?? 0),
                                        )
                                      : r,
                                  ),
                                )
                              }
                            />
                          </Table.Td>
                        ),
                      )}
                      <Table.Td>
                        <Button
                          size="xs"
                          variant="subtle"
                          onClick={() =>
                            patch(
                              "shop",
                              key,
                              rows.filter((_, n) => n !== i),
                            )
                          }
                        >
                          删除行
                        </Button>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
              <Button
                size="xs"
                onClick={() =>
                  patch("shop", key, [...rows, [0, 0, 0, 0, 0, 0]])
                }
              >
                添加等级
              </Button>
            </Stack>
          </Card>
        );
      })}
      {(["charStockByLevel", "equipStockByLevel"] as const).map((key) => (
        <Card key={key} withBorder>
          <Stack gap="xs">
            <Group>
              <Text fw={600}>
                {key === "charStockByLevel" ? "棋子" : "装备"}每种基础库存
              </Text>
              <Button
                size="xs"
                variant="light"
                onClick={() => patch("shop", key, undefined)}
              >
                使用默认
              </Button>
              <Button
                size="xs"
                variant="light"
                onClick={() => patch("shop", key, {})}
              >
                明确为空
              </Button>
            </Group>
            <Text size="xs">
              共享库存仍沿用原有玩家人数倍率；空字典或库存 0 不供应。
            </Text>
            <Group>
              {Object.entries(effective.shop[key]).map(([level, n]) => (
                <CNumberInput
                  w={130}
                  key={level}
                  min={0}
                  allowDecimal={false}
                  label={`${level} 阶`}
                  value={n}
                  onChange={(v) =>
                    patch("shop", key, {
                      ...effective.shop[key],
                      [level]: Number(v),
                    })
                  }
                />
              ))}
            </Group>
            <Button
              size="xs"
              variant="light"
              onClick={() =>
                patch("shop", key, {
                  ...effective.shop[key],
                  [Math.max(
                    0,
                    ...Object.keys(effective.shop[key]).map(Number),
                  ) + 1]: 0,
                })
              }
            >
              添加阶级库存
            </Button>
          </Stack>
        </Card>
      ))}
      <Divider label="每回合收入与免费刷新" />
      <Text size="sm">
        第 1 项是第 1 回合基础值；超出表长沿用最后一项，空数组为
        0。金币每轮替换为对应基础收入；战斗与休整结束奖励另行累加。免费刷新按进入的回合发放，第一项用于开局。
      </Text>
      {(["incomeByDifficulty", "freeRefreshByDifficulty"] as const).map(
        (key) => (
          <Card key={key} withBorder>
            <Stack>
              <Group>
                <Text fw={600}>
                  {key === "incomeByDifficulty" ? "基础金币" : "每轮免费刷新"}
                </Text>
                <Button
                  size="xs"
                  variant="light"
                  onClick={() => patch("economy", key, undefined)}
                >
                  全部默认
                </Button>
                <Button
                  size="xs"
                  variant="light"
                  onClick={() => patch("economy", key, {})}
                >
                  全部清空
                </Button>
              </Group>
              {difficulties.map((difficulty) => {
                const rows = effective.economy[key][difficulty] ?? [];
                return (
                  <Stack key={difficulty} gap="xs">
                    <Group>
                      <Text>{difficulty}</Text>
                      <Button
                        size="xs"
                        variant="light"
                        onClick={() =>
                          patch("economy", key, {
                            ...effective.economy[key],
                            [difficulty]: [],
                          })
                        }
                      >
                        明确为空
                      </Button>
                      <Button
                        size="xs"
                        variant="light"
                        onClick={() =>
                          patch("economy", key, {
                            ...effective.economy[key],
                            [difficulty]: [...rows, rows.at(-1) ?? 0],
                          })
                        }
                      >
                        添加回合
                      </Button>
                    </Group>
                    <Group>
                      {rows.map((value, i) => (
                        <CNumberInput
                          key={i}
                          w={85}
                          label={`第 ${i + 1} 轮`}
                          min={0}
                          allowDecimal={false}
                          value={value}
                          onChange={(v) =>
                            patch("economy", key, {
                              ...effective.economy[key],
                              [difficulty]: rows.map((n, j) =>
                                j === i ? Number(v) : n,
                              ),
                            })
                          }
                        />
                      ))}
                    </Group>
                  </Stack>
                );
              })}
            </Stack>
          </Card>
        ),
      )}
    </Stack>
  );
}
