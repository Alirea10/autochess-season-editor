# PE Export Memory

This note records the current PE-compatible export rules for future edits.

- Entry point: `normalizeSeasonDataForPeJson` in `packages/shared/src/utils.ts`.
- UI action: season tab menu item `PE 兼容导出` in `packages/editor/src/components/SeasonTabs.tsx`.
- Current PE rule removes the unsupported Ursus package from the exported single JSON only.
- Remove bond id `ursusShip`.
- Remove Ursus chess ids from `ursusShip.chessIdList`, except the special kept operators below, and remove all ids with prefix `chess_ursus_`.
- Keep Gummy: `chess_char_1_10_a`, `chess_char_1_10_b`; deleting `ursusShip` naturally removes only her Ursus bond.
- Keep Zoya: `chess_char_2_17_a`, `chess_char_2_17_b`; add both ids to `soloShip` so her Ursus relationship becomes Solo in PE export.
- Clear or remove direct dangling references to removed bond/chess/effects from modes, lookup maps, trap shop data, garrison blackboard bond lists, effects, and buff templates.

