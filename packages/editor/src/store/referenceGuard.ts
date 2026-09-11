import { notifications } from "@mantine/notifications";
import { findSeasonReferences } from "@autochess-editor/shared";
export function canDeleteSeasonEntry(
  data: unknown,
  id: string,
  definition: string,
): boolean {
  const refs = findSeasonReferences(data, id, [definition]);
  if (!refs.length) return true;
  notifications.show({
    title: "仍被引用，未删除",
    message: `${id} 被 ${refs.length} 处引用：${refs.slice(0, 8).join("；")}。请先调整引用；杂项「诊断 / 引用」可查看全部路径。`,
    color: "orange",
    autoClose: false,
  });
  return false;
}
