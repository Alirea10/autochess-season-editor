import { canDeleteSeasonEntry } from '../../store/referenceGuard'
import { useState, useEffect } from "react";
import {
  Stack,
  Group,
  Text,
  Title,
  Button,
  Card,
  Alert,
  Badge,
} from "@mantine/core";
import {
  CNumberInput,
  CSelect,
  CTextInput,
  CTextarea,
  CollabEditingProvider,
} from "../collab/CollabInputs";
import { collectEnemyRoots, resourceIssues } from "@autochess-editor/shared";
import type { ClientResources, EnemyResource } from "@autochess-editor/shared";
import type { DataStore } from "../../store/dataStore";

export function RuntimeRewardPoolsEditor({ store }: { store: DataStore }) {
  const [name, setName] = useState("");
  const { activeSeason, activeSeasonId, updateSeason } = store;
  if (!activeSeason) return null;
  const data = activeSeason.data;
  const pools = data.runtimeConfig?.rewardPools ?? {};
  const write = (
    id: string,
    entries: { chessId: string; value: number }[] | undefined,
  ) => {
    if (entries === undefined && !["pool_chess_glady", "pool_equip_rockr", "pool_equip_vict", "pool_equip_pepe", "pool_equip_normal", "pool_equip_shop_1", "pool_equip_kathe", "pool_equip_narant", "pool_char_pinus", "pool_char_later"].includes(id) && !canDeleteSeasonEntry(store.getSeason(activeSeasonId!)?.data, id, `runtimeConfig.rewardPools.${id}`)) return
    updateSeason(activeSeasonId!, (d) => {
      const next = { ...d.runtimeConfig?.rewardPools };
      if (entries === undefined) delete next[id];
      else next[id] = entries;
      return {
        ...d,
        runtimeConfig: { ...d.runtimeConfig, version: 1, rewardPools: next },
      };
    });
  };
  const goods = [
    ...Object.keys(data.charChessDataDict),
    ...Object.keys(data.trapChessDataDict),
  ].map((id) => ({ value: id, label: id }));
  const referenced = [
    ...new Set(
      Object.values(data.effectBuffInfoDataDict).flatMap((entries) =>
        entries.flatMap((e) =>
          e.blackboard
            .filter((b) => b.key === "pool" && b.valueStr)
            .map((b) => b.valueStr!),
        ),
      ),
    ),
  ];
  return (
    <Stack>
      <Title order={5}>局内奖励池</Title>
      <Text size="sm">
        效果通过池名引用。未声明的原有池使用兼容规则；声明空池表示停用奖励。权重
        0 不参与抽取。此配置与下方局外结算奖励分别生效。
      </Text>
      <Group>
        <CTextInput
          label="新池名"
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
        />
        <Button
          disabled={!name.trim() || Object.hasOwn(pools, name.trim())}
          onClick={() => {
            write(name.trim(), []);
            setName("");
          }}
        >
          添加空池
        </Button>
      </Group>
      {referenced
        .filter((id) => !Object.hasOwn(pools, id))
        .map((id) => (
          <Group key={id}>
            <Text size="sm">{id}：使用默认（若存在）</Text>
            <Button size="xs" variant="light" onClick={() => write(id, [])}>
              声明此池
            </Button>
          </Group>
        ))}
      {Object.entries(pools).map(([id, entries]) => (
        <Card key={id} withBorder>
          <Group justify="space-between">
            <Text fw={600}>{id}</Text>
            <Badge>
              {entries.length ? `${entries.length} 个条目` : "明确为空"}
            </Badge>
            <Button
              size="xs"
              color="red"
              variant="light"
              onClick={() => write(id, undefined)}
            >
              移除声明 / 使用默认
            </Button>
          </Group>
          <Stack mt="sm">
            {entries.map((entry, index) => (
              <Group key={index} align="end">
                <CSelect
                  label="棋子或物品 ID"
                  searchable
                  data={goods}
                  value={entry.chessId}
                  onChange={(id2) =>
                    write(
                      id,
                      entries.map((e, i) =>
                        i === index ? { ...e, chessId: id2 ?? "" } : e,
                      ),
                    )
                  }
                />
                <CNumberInput
                  label="权重"
                  min={0}
                  value={entry.value}
                  onChange={(v) =>
                    write(
                      id,
                      entries.map((e, i) =>
                        i === index ? { ...e, value: Number(v) } : e,
                      ),
                    )
                  }
                />
                <Button
                  color="red"
                  variant="subtle"
                  onClick={() =>
                    write(
                      id,
                      entries.filter((_, i) => i !== index),
                    )
                  }
                >
                  删除条目
                </Button>
              </Group>
            ))}
            <Button
              variant="light"
              onClick={() =>
                write(id, [
                  ...entries,
                  { chessId: goods[0]?.value ?? "", value: 1 },
                ])
              }
            >
              添加条目
            </Button>
          </Stack>
        </Card>
      ))}
    </Stack>
  );
}

const splitIds = (value: string) => [
  ...new Set(value.split(/[,|;\s]+/).filter(Boolean)),
];
function EnemyIdsInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string[] | undefined;
  onChange: (ids: string[]) => void;
}) {
  const normalized = (value ?? []).join("\n");
  const [text, setText] = useState(normalized);
  useEffect(() => {
    setText((previous) =>
      splitIds(previous).join("\n") === normalized ? previous : normalized,
    );
  }, [normalized]);
  return (
    <CTextarea
      label={label}
      autosize
      minRows={2}
      value={text}
      onChange={(event) => {
        const next = event.currentTarget.value;
        setText(next);
        onChange(splitIds(next));
      }}
    />
  );
}
export function ClientResourcesEditor({ store }: { store: DataStore }) {
  const [enemyId, setEnemyId] = useState("");
  const [iconId, setIconId] = useState("");
  const [modeId, setModeId] = useState("");
  const { activeSeason, activeSeasonId, updateSeason } = store;
  if (!activeSeason) return null;
  const data = activeSeason.data;
  const resources = data.runtimeConfig?.clientResources ?? {};
  const patch = (change: Partial<ClientResources>) =>
    updateSeason(activeSeasonId!, (d) => ({
      ...d,
      runtimeConfig: {
        ...d.runtimeConfig,
        version: 1,
        clientResources: { ...d.runtimeConfig?.clientResources, ...change },
      },
    }));
  const enemy = (id: string, change: Partial<EnemyResource> | undefined) => {
    const next = { ...resources.enemyResources };
    if (change === undefined) delete next[id];
    else next[id] = { ...next[id], ...change };
    patch({ enemyResources: next });
  };
  const roots = collectEnemyRoots(data);
  const issues = resourceIssues(resources);
  return (
    <CollabEditingProvider itemId="clientResources">
      <Stack>
        <Title order={5}>客户端资源</Title>
        <Text size="sm">
          特殊敌人、附属敌人、分类和受支持的生成效果会自动预载。以下声明用于补充预载，以及覆盖原生元数据。召唤、分裂、变形依赖填写在敌人依赖中；排除名单不会加入预载。
        </Text>
        {issues.map((i) => (
          <Alert key={i.path} color="red" title={i.path}>
            {i.message}
          </Alert>
        ))}
        <EnemyIdsInput
          key={activeSeasonId}
          label="额外预载敌人（每行一个 ID）"
          value={resources.preloadEnemies}
          onChange={(ids) => patch({ preloadEnemies: ids })}
        />
        <Text size="sm">
          当前正向预载来源：{roots.size} 个；客户端还会展开原生及赛季依赖。
        </Text>
        <details>
          <summary>查看敌人及来源</summary>
          {[...roots].map(([id, paths]) => (
            <Text key={id} size="xs">
              {id} — {paths.join("；")}
            </Text>
          ))}
        </details>
        <Group align="end">
          <CTextInput
            label="敌人 ID"
            value={enemyId}
            onChange={(e) => setEnemyId(e.currentTarget.value)}
          />
          <Button
            disabled={
              !/^enemy_[a-z0-9_]+$/i.test(enemyId) ||
              Object.hasOwn(resources.enemyResources ?? {}, enemyId)
            }
            onClick={() => {
              enemy(enemyId, {});
              setEnemyId("");
            }}
          >
            添加敌人资源声明
          </Button>
        </Group>
        {Object.entries(resources.enemyResources ?? {}).map(([id, entry]) => (
          <Card withBorder key={id}>
            <Stack>
              <Group justify="space-between">
                <Text fw={600}>{id}</Text>
                <Button
                  size="xs"
                  color="red"
                  onClick={() => enemy(id, undefined)}
                >
                  删除声明
                </Button>
              </Group>
              <Text size="xs">
                空白数值沿用原生值；新敌人默认等级 0、额外标识 0、战力系数
                1。飞行类型优先沿用原生值，新敌人参考 FLY 分类。
              </Text>
              <Group>
                {(
                  [
                    "level",
                    "extraEnemyIdentifier",
                    "enemyBattleEffectivenessFactor",
                  ] as const
                ).map((field) => (
                  <CNumberInput
                    key={field}
                    label={
                      field === "level"
                        ? "等级"
                        : field === "extraEnemyIdentifier"
                          ? "额外标识"
                          : "战力系数"
                    }
                    min={0}
                    value={entry[field] ?? ""}
                    onChange={(v) =>
                      enemy(id, { [field]: v === "" ? undefined : Number(v) })
                    }
                  />
                ))}
                <CSelect
                  label="移动类型"
                  data={[
                    { value: "native", label: "沿用原生 / 分类" },
                    { value: "false", label: "地面" },
                    { value: "true", label: "飞行" },
                  ]}
                  value={
                    entry.isFlyEnemy === undefined
                      ? "native"
                      : String(entry.isFlyEnemy)
                  }
                  onChange={(v) =>
                    enemy(id, {
                      isFlyEnemy: v === "native" ? undefined : v === "true",
                    })
                  }
                />
              </Group>
              <EnemyIdsInput
                key={`${activeSeasonId}:${id}`}
                label={`召唤 / 分裂 / 变形依赖（${entry.extraEnemyKeyList === undefined ? "沿用原生" : entry.extraEnemyKeyList.length ? "赛季声明" : "明确为空"}）`}
                value={entry.extraEnemyKeyList}
                onChange={(ids) => enemy(id, { extraEnemyKeyList: ids })}
              />
              <Group>
                <Button
                  size="xs"
                  variant="light"
                  onClick={() => enemy(id, { extraEnemyKeyList: [] })}
                >
                  依赖设为空
                </Button>
                <Button
                  size="xs"
                  variant="light"
                  onClick={() => enemy(id, { extraEnemyKeyList: undefined })}
                >
                  依赖使用原生值
                </Button>
              </Group>
            </Stack>
          </Card>
        ))}
        <Title order={5}>自定义图标</Title>
        <Text size="sm">
          图标 ID 应与盟约的 iconId 一致。使用 icon/ 下的 PNG
          路径；提供下载地址时会自动下载。更换内容时请更换地址和路径，避免与正在使用的赛季共用文件。
        </Text>
        <Group align="end">
          <CTextInput
            label="图标 ID"
            value={iconId}
            onChange={(e) => setIconId(e.currentTarget.value)}
          />
          <Button
            disabled={!iconId || Object.hasOwn(resources.icons ?? {}, iconId)}
            onClick={() => {
              patch({
                icons: {
                  ...resources.icons,
                  [iconId]: { path: `icon/${iconId}.png` },
                },
              });
              setIconId("");
            }}
          >
            添加图标
          </Button>
        </Group>
        {Object.entries(resources.icons ?? {}).map(([id, icon]) => (
          <Card withBorder key={id}>
            <Stack>
              <Text>{id}</Text>
              <CTextInput
                label="PNG 相对路径"
                value={icon.path}
                onChange={(e) =>
                  patch({
                    icons: {
                      ...resources.icons,
                      [id]: { ...icon, path: e.currentTarget.value },
                    },
                  })
                }
              />
              <CTextInput
                label="下载地址（可选）"
                value={icon.url ?? ""}
                onChange={(e) =>
                  patch({
                    icons: {
                      ...resources.icons,
                      [id]: {
                        ...icon,
                        url: e.currentTarget.value || undefined,
                      },
                    },
                  })
                }
              />
              <Button
                color="red"
                variant="light"
                onClick={() => {
                  const next = { ...resources.icons };
                  delete next[id];
                  patch({ icons: next });
                }}
              >
                删除图标声明
              </Button>
            </Stack>
          </Card>
        ))}
        <Title order={5}>原生模式资源映射</Title>
        <Text size="sm">
          为新增模式复用已有原生回合资源。未指定来源的模式按类型和难度自动匹配；显式空表表示不添加适配。
        </Text>
        <Group align="end">
          <CSelect
            searchable
            label="赛季模式"
            data={Object.keys(data.modeDataDict)}
            value={modeId || null}
            onChange={(v) => setModeId(v ?? "")}
          />
          <Button
            disabled={
              !modeId || Object.hasOwn(resources.modeAliases ?? {}, modeId)
            }
            onClick={() =>
              patch({
                modeAliases: {
                  ...resources.modeAliases,
                  [modeId]: "",
                },
              })
            }
          >
            添加映射
          </Button>
          <Button variant="light" onClick={() => patch({ modeAliases: {} })}>
            明确不添加映射
          </Button>
          <Button
            variant="light"
            onClick={() => patch({ modeAliases: undefined })}
          >
            按类型和难度自动适配
          </Button>
        </Group>
        {Object.entries(resources.modeAliases ?? {}).map(([id, source]) => (
          <Group key={id}>
            <CTextInput
              label={id}
              value={source}
              onChange={(e) =>
                patch({
                  modeAliases: {
                    ...resources.modeAliases,
                    [id]: e.currentTarget.value,
                  },
                })
              }
            />
            <Button
              variant="light"
              color="red"
              onClick={() => {
                const next = { ...resources.modeAliases };
                delete next[id];
                patch({ modeAliases: next });
              }}
            >
              删除
            </Button>
          </Group>
        ))}
      </Stack>
    </CollabEditingProvider>
  );
}
