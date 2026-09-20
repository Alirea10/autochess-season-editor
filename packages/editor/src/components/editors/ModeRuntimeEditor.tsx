import { DifficultyScalingEditor } from "./DifficultyScalingEditor";
import {
  Stack,
  Group,
  Text,
  Button,
  Card,
  Divider,
} from "@mantine/core";
import { CNumberInput } from "../collab/CollabInputs";
import { resolveModeRuntime } from "@autochess-editor/shared";
import type {
  ModeDataDictMode,
  BountyGroup,
} from "@autochess-editor/shared";

export function ModeRuntimeEditor({
  mode,
  patch,
}: {
  mode: ModeDataDictMode;
  patch: (value: Partial<ModeDataDictMode>) => void;
}) {
  const effective = resolveModeRuntime(mode);
  const groups = effective.bountyGroups;
  const writeGroup = (index: number, value: Partial<BountyGroup>) =>
    patch({
      bountyGroups: (groups ?? []).map((g, i) =>
        i === index ? { ...g, ...value } : g,
      ),
    });
  return (
    <Card withBorder>
      <Stack>
        <DifficultyScalingEditor mode={mode} patch={patch} />
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
