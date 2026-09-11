import { useState } from "react";
import {
  Stack,
  Group,
  Text,
  Button,
  Alert,
  Table,
  Card,
  PasswordInput,
  Code,
} from "@mantine/core";
import { CSelect, CTextInput } from "../collab/CollabInputs";
import {
  BOND_RUNTIME_KEYS,
  OTHER_SERVER_KEYS,
  BOUNTY_GENERATORS,
  resolveEconomyRuntime,
  resolveModeRuntime,
  capacityIssues,
  resourceIssues,
  parseBountyEffects,
  findSeasonReferences,
  missingSeasonReferences,
} from "@autochess-editor/shared";
import type { DataStore, ActiveModule } from "../../store/dataStore";
import { flushPendingEdits } from "../../store/pendingEdits";

const modules: Record<string, ActiveModule> = {
  bondInfoDict: "bonds",
  bossInfoDict: "boss",
  modeDataDict: "modes",
  effectInfoDataDict: "effects",
  effectBuffInfoDataDict: "effects",
  buffTemplates: "buffs",
};
export function SeasonDiagnosticsEditor({ store }: { store: DataStore }) {
  const [filter, setFilter] = useState("");
  const [query, setQuery] = useState<string | null>(null),
    [url, setUrl] = useState(""),
    [token, setToken] = useState("");
  const [report, setReport] = useState<any>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  if (!store.activeSeason) return null;
  const data = store.activeSeason.data;
  const messages: { path: string; message: string; source?: string }[] = [
    ...capacityIssues(data.constData),
    ...resourceIssues(data.runtimeConfig?.clientResources),
  ];
  const add = (path: string, message: string, source?: string) => {
    if (message) messages.push({ path, message, source });
  };
  const local = resolveEconomyRuntime(data.runtimeConfig, add);
  for (const [id, mode] of Object.entries(data.modeDataDict ?? {})) {
    if (mode && typeof mode === "object") resolveModeRuntime(mode, add);
    else add(`modeDataDict.${id}`, "模式不是对象");
  }
  parseBountyEffects(data, add);
  const missing = missingSeasonReferences(data);
  const ids = [
    ...new Set([
      ...Object.keys(data.bondInfoDict),
      ...Object.keys(data.bossInfoDict),
      ...Object.keys(data.modeDataDict),
      ...Object.keys(data.buffTemplates ?? {}),
      ...Object.keys(data.runtimeConfig?.rewardPools ?? {}),
    ]),
  ];
  const refs = query
    ? findSeasonReferences(
        data,
        query,
        ids.includes(query)
          ? [
              `bondInfoDict.${query}`,
              `bossInfoDict.${query}`,
              `modeDataDict.${query}`,
              `buffTemplates.${query}`,
              `runtimeConfig.rewardPools.${query}`,
            ]
          : [],
      )
    : [];
  const go = (path: string) => {
    const [table, id] = path.split(".");
    if (modules[table]) store.navigateTo(modules[table], id);
  };
  const validate = async () => {
    setBusy(true);
    setError("");
    setReport(null);
    try {
      flushPendingEdits();
      const base = new URL(url);
      if (!["http:", "https:"].includes(base.protocol))
        throw new Error("请输入 HTTP(S) 游戏服务器地址");
      const response = await fetch(new URL("/seasons/validate", base), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          data: store.getSeason(store.activeSeasonId!)!.data,
          includeEffectiveData: false,
        }),
        signal: AbortSignal.timeout(30000),
      });
      const result = await response.json();
      if (!Object.hasOwn(result, "valid"))
        throw new Error(
          result.error ?? result.message ?? `HTTP ${response.status}`,
        );
      setReport(result);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };
  const effects = Object.entries(data.effectBuffInfoDataDict ?? {}).flatMap(
    ([id, entries]) =>
      Array.isArray(entries)
        ? entries
            .filter((entry) => entry && typeof entry.key === "string")
            .map((entry, index) => ({ id, index, entry }))
        : [],
  );
  return (
    <Stack>
      <Text fw={600}>本地配置诊断</Text>
      <Text size="sm">
        本地检查新增运行时契约和引用；完整局部回退与来源以游戏服务器解析报告为准。
      </Text>
      {!messages.length && !missing.length && (
        <Alert color="teal">当前本地检查未发现问题。</Alert>
      )}
      {messages.map((m, i) => (
        <Alert color="orange" key={i}>
          <Button variant="subtle" size="xs" onClick={() => go(m.path)}>
            {m.path}
          </Button>
          {m.message} {m.source ? `采用来源：${m.source}` : ""}
        </Alert>
      ))}
      {missing.map((m, i) => (
        <Alert color="orange" key={`ref${i}`}>
          <Button variant="subtle" size="xs" onClick={() => go(m.path)}>
            {m.path}
          </Button>
          引用不存在：{m.id}
        </Alert>
      ))}
      <CSelect
        label="查看实体被哪些字段引用"
        searchable
        clearable
        data={ids}
        value={query}
        onChange={setQuery}
      />
      {refs.map((path) => (
        <Text key={path} size="sm">
          <Button size="xs" variant="subtle" onClick={() => go(path)}>
            {path}
          </Button>
        </Text>
      ))}
      <Card withBorder>
        <Stack>
          <Text fw={600}>游戏服务器完整解析</Text>
          <Text size="sm">
            使用游戏服务器的
            JWT（与编辑器账号独立）。仅验证，不上传更新赛季；凭据只保留在本页内存。
          </Text>
          <CTextInput
            label="游戏服务器地址"
            placeholder="http://服务器:端口"
            value={url}
            onChange={(e) => setUrl(e.currentTarget.value)}
          />
          <PasswordInput
            label="游戏服务器 JWT"
            value={token}
            onChange={(e) => setToken(e.currentTarget.value)}
          />
          <Button loading={busy} disabled={!url || !token} onClick={validate}>
            请求解析报告
          </Button>
          {error && <Alert color="red">{error}</Alert>}
          {report && (
            <>
              <Alert color={report.valid ? "teal" : "red"}>
                解析器 {report.resolverVersion} ·{" "}
                {report.valid ? "可用" : "无法使用"} · {report.effectiveHash}
              </Alert>
              {(report.diagnostics ?? []).map((m: any, i: number) => (
                <Alert
                  key={i}
                  color={m.severity === "error" ? "red" : "orange"}
                >
                  {m.path}: {m.message}（{m.source}）
                </Alert>
              ))}
              <details>
                <summary>最终配置与字段来源</summary>
                <Code block>
                  {JSON.stringify(
                    {
                      resolvedConfig: report.resolvedConfig,
                      sources: report.sources,
                    },
                    null,
                    2,
                  )}
                </Code>
              </details>
            </>
          )}
        </Stack>
      </Card>
      <Text fw={600}>效果执行位置与参数</Text>
      <Text size="sm">
        “专用或待确认”表示未列入通用整备处理器，也没有本赛季战斗模板；不等同于已确认支持。效果参数仍在效果编辑页修改。
      </Text>
      <CTextInput
        label="搜索效果 ID / key"
        value={filter}
        onChange={(e) => setFilter(e.currentTarget.value)}
      />
      <Text size="xs">最多显示 100 条；搜索可定位其余条目。</Text>
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>效果 / 条目</Table.Th>
            <Table.Th>Key</Table.Th>
            <Table.Th>执行位置</Table.Th>
            <Table.Th>参数</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {effects
            .filter(({ id, entry }) =>
              `${id} ${entry.key}`.toLowerCase().includes(filter.toLowerCase()),
            )
            .slice(0, 100)
            .map(({ id, index, entry }) => {
              const kind = [
                ...(BOND_RUNTIME_KEYS as readonly string[]),
                ...OTHER_SERVER_KEYS,
              ].includes(entry.key)
                ? "服务器通用整备"
                : data.effectInfoDataDict[id]?.effectType === "ENEMY_GAIN" &&
                    Object.hasOwn(BOUNTY_GENERATORS, entry.key)
                  ? "服务器悬赏 / 客户端预载"
                  : Object.hasOwn(data.buffTemplates ?? {}, entry.key)
                    ? "客户端战斗模板"
                    : "专用或待确认";
              return (
                <Table.Tr key={`${id}/${index}`}>
                  <Table.Td>
                    <Button
                      size="xs"
                      variant="subtle"
                      onClick={() => store.navigateTo("effects", id)}
                    >
                      {id} / {index + 1}
                    </Button>
                  </Table.Td>
                  <Table.Td>{entry.key}</Table.Td>
                  <Table.Td>{kind}</Table.Td>
                  <Table.Td>
                    <Text size="xs">
                      {(Array.isArray(entry.blackboard) ? entry.blackboard : [])
                        .filter(Boolean)
                        .map((b) => `${b.key}=${b.valueStr ?? b.value}`)
                        .join("，")}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              );
            })}
        </Table.Tbody>
      </Table>
      <details>
        <summary>本地有效经济配置</summary>
        <Code block>{JSON.stringify(local, null, 2)}</Code>
      </details>
    </Stack>
  );
}
