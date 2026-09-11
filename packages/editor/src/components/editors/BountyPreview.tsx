import { Card, Stack, Group, Text, Button, Alert } from "@mantine/core";
import {
  parseBountyEffects,
  BOUNTY_GENERATORS,
} from "@autochess-editor/shared";
import type { DataStore } from "../../store/dataStore";

export function BountyPreview({
  store,
  effectId,
}: {
  store: DataStore;
  effectId: string;
}) {
  if (!store.activeSeason) return null;
  const data = store.activeSeason.data;
  const messages: string[] = [];
  const bounty = parseBountyEffects(
    {
      ...data,
      effectInfoDataDict: { [effectId]: data.effectInfoDataDict[effectId] },
    },
    (path, reason) => messages.push(`${path}: ${reason}`),
  )[effectId];
  return (
    <Card withBorder>
      <Stack gap="xs">
        <Text fw={600}>悬赏生成与自动预载</Text>
        <Text size="sm">
          ENEMY_GAIN 中所有支持的生成条目都会被读取。下方 blackboard 可编辑
          enemy_id、count（每种敌人数）、coin（每个敌人奖励）、round（持续回合）；不需要另填预载名单。游戏已包含的条目保留原生资源。
        </Text>
        <Text size="xs">
          新增条目后填写 enemy_id；count 或 round 为 0 表示停用该条目。
        </Text>
        <Group>
          {Object.keys(BOUNTY_GENERATORS).map((key) => (
            <Button
              size="xs"
              variant="light"
              key={key}
              onClick={() =>
                store.updateSeason(store.activeSeasonId!, (d) => ({
                  ...d,
                  effectBuffInfoDataDict: {
                    ...d.effectBuffInfoDataDict,
                    [effectId]: [
                      ...(d.effectBuffInfoDataDict[effectId] ?? []),
                      {
                        key,
                        countType: "NONE",
                        blackboard: [
                          { key: "enemy_id", value: 0, valueStr: "" },
                          { key: "count", value: 1, valueStr: null },
                          { key: "coin", value: 1, valueStr: null },
                          {
                            key: "round",
                            value: key.startsWith("next_battle") ? 1 : 2,
                            valueStr: null,
                          },
                        ],
                      },
                    ],
                  },
                }))
              }
            >
              {key}
            </Button>
          ))}
        </Group>
        {messages.map((message, i) => (
          <Alert color="orange" key={i}>
            {message}
          </Alert>
        ))}
        {!bounty && <Text c="dimmed">当前没有可执行的悬赏生成条目。</Text>}
        {bounty?.spawns.map((spawn, i) => (
          <Text size="sm" key={i}>
            条目 {spawn.entryIndex + 1}：{spawn.enemyId} × {spawn.count}，持续{" "}
            {spawn.rounds} 回合，{spawn.rewardType === "kill" ? "击杀" : "胜利"}
            每个获得 {spawn.coin} 金币；自动预载。
          </Text>
        ))}
      </Stack>
    </Card>
  );
}
