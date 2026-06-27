# 赛季 Ban 配置说明

## 概述

赛季 JSON 文件支持可选的 `banConfig` 字段，用于控制每局游戏开始时的羁绊禁用规则。不配置则使用默认行为。

## 字段定义

```jsonc
{
    "banConfig": {
        // 免疫羁绊：这些羁绊永远不会被 ban
        "immuneBonds": ["emptyShip", "deputShip"],

        // 核心羁绊 ID 列表（覆盖硬编码的 8 个默认阵营）
        "coreBondIds": ["yanShip", "sargonShip", "victoriaShip", "ursusShip"],

        // 次要羁绊候选列表（显式声明哪些羁绊参与次要 ban 抽取）
        // 不填则自动从赛季所有羁绊中排除核心和免疫羁绊得到
        "minorBondIds": ["indomShip", "skillfulShip", "raidShip", "steadShip"],

        // 从核心羁绊中随机 ban 的数量
        "coreBondBanCount": 2,

        // 从次要羁绊（非核心、非免疫）中随机 ban 的数量
        "minorBondBanCount": 3
    },

    // ... 其他赛季数据字段（不变）
    "charChessDataDict": { },
    "bondInfoDict": { }
}
```

## 字段说明

所有字段均可选，未提供时按当前赛季自动使用硬编码默认值。

| 字段 | 类型 | 必填 | 默认值（act1 / act2） | 说明 |
|---|---|---|---|---|
| `immuneBonds` | `string[]` | 否 | act1: `deputShip, emptyShip, visiShip` / act2: `suntShip, emptyShip, maniShip, investShip` | 羁绊 ID 列表，这些羁绊不会被随机选中 ban |
| `coreBondIds` | `string[]` | 否 | 硬编码的 8 个阵营（见下表） | 核心羁绊 ID 列表，传入后完全覆盖默认值 |
| `minorBondIds` | `string[]` | 否 | 赛季中非核心非免疫的所有羁绊 | 次要羁绊候选列表，传入后只从这些羁绊中抽取 ban |
| `coreBondBanCount` | `number` | 否 | act1: 2 / act2: 3 | 从核心羁绊中 ban 的数量 |
| `minorBondBanCount` | `number` | 否 | act1: 2 / act2: 4 | 从次要羁绊中 ban 的数量 |

## 默认核心羁绊 ID（不配置 `coreBondIds` 时使用）

| ID | 阵营 |
|---|---|
| `yanShip` | 炎 |
| `sargonShip` | 萨尔贡 |
| `victoriaShip` | 维多利亚 |
| `kjeragShip` | 谢拉格 |
| `lateranoShip` | 拉特兰 |
| `egirShip` | 阿戈尔 |
| `kazimierzShip` | 卡西米尔 |
| `siracusaShip` | 叙拉古 |

如需添加自定义阵营（如乌萨斯）到核心羁绊，必须通过 `coreBondIds` 字段显式列出完整列表。

## 默认行为（不配置 banConfig 时）

| 赛季判定 | 核心 ban 数 | 次要 ban 数 | 免疫羁绊 |
|---|---|---|---|
| 无卡西米尔羁绊 (act1) | 2 | 2 | `deputShip`, `emptyShip`, `visiShip` |
| 有卡西米尔羁绊 (act2) | 3 | 4 | `suntShip`, `emptyShip`, `maniShip`, `investShip` |

## 注意事项

- `banConfig` 及其内部所有字段均为**可选**，不填则完全兼容原有行为
- 只填部分字段时，未填的字段自动使用对应赛季的默认值
- 棋子被 ban 的条件是它的**所有羁绊**都在 ban 列表中，只要有一个羁绊未被 ban，该棋子就不会被禁
- `immuneBonds` 中的 ID 不需要一定是核心羁绊，任何羁绊 ID 都可以设为免疫
- 如果赛季中有英雄专属羁绊等不应参与 ban 的羁绊，建议用 `minorBondIds` 显式指定次要候选池，避免 ban 到无意义的羁绊上
