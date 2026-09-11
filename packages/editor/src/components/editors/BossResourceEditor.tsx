import { Card, Stack, Text, Button } from "@mantine/core";
import { CTextInput } from "../collab/CollabInputs";
import type { ClientResources } from "@autochess-editor/shared";
import type { DataStore } from "../../store/dataStore";

export function BossResourceEditor({
  store,
  bossId,
}: {
  store: DataStore;
  bossId: string;
}) {
  if (!store.activeSeason) return null;
  const mapping =
    store.activeSeason.data.runtimeConfig?.clientResources?.bossResources?.[
      bossId
    ];
  const write = (
    value: NonNullable<ClientResources["bossResources"]>[string] | undefined,
  ) =>
    store.updateSeason(store.activeSeasonId!, (data) => {
      const resources = data.runtimeConfig?.clientResources;
      const bossResources = { ...resources?.bossResources };
      if (value === undefined) delete bossResources[bossId];
      else bossResources[bossId] = value;
      return {
        ...data,
        runtimeConfig: {
          ...data.runtimeConfig,
          version: 1,
          clientResources: { ...resources, bossResources },
        },
      };
    });
  return (
    <Card withBorder>
      <Stack gap="xs">
        <Text fw={600}>原生 Boss 敌人映射</Text>
        <Text size="sm">
          原有 Boss 可使用游戏映射。新增 Boss 必须指定游戏已有的敌人
          ID；这里独立于下方赛季血量配置，并自动加入资源预载。
        </Text>
        <CTextInput
          label="enemyId"
          placeholder="未声明：使用原生映射"
          collabField="bossResources.enemyId"
          value={mapping?.enemyId ?? ""}
          onChange={(e) =>
            write({ ...mapping, enemyId: e.currentTarget.value })
          }
        />
        <CTextInput
          label="handbookEnemyId（可选）"
          placeholder="使用 enemyId"
          collabField="bossResources.handbookEnemyId"
          value={mapping?.handbookEnemyId ?? ""}
          onChange={(e) =>
            write({
              enemyId: mapping?.enemyId ?? "",
              handbookEnemyId: e.currentTarget.value || undefined,
            })
          }
        />
        <Button size="xs" variant="light" onClick={() => write(undefined)}>
          使用原生映射
        </Button>
      </Stack>
    </Card>
  );
}
