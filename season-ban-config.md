# 盟约分类、规则 tag 与原版回退

## 新配置

类别仅负责抽选；同一盟约可归属多个类别。每类独立、不放回抽选，候选不足时取全部，跨类结果按盟约 ID 去重。盟约规则不依赖抽选来源。

```json
{
  "banConfig": {
    "coreBondIds": ["yanShip"],
    "minorBondIds": ["raidShip"],
    "coreBondBanCount": 1,
    "minorBondBanCount": 1,
    "immuneBonds": [],
    "classification": {
      "version": 1,
      "classes": {
        "core": { "name": "核心盟约", "bondIds": ["yanShip"], "drawCount": 1 },
        "minor": { "name": "小盟约", "bondIds": ["raidShip"], "drawCount": 1 },
        "secondary": { "name": "次要盟约", "bondIds": ["skillfulShip"], "drawCount": 0 }
      },
      "bondRules": {
        "yanShip": "all",
        "raidShip": "release",
        "skillfulShip": "ignore"
      }
    }
  }
}
```

classes 必须包含 core 和 minor 两个默认类，允许添加自定义类别；类别包含名称、成员 ID 和非负整数 drawCount。每个盟约只能配置一种 bondRules 规则，未声明的规则默认为 normal。默认核心类成员同步 coreBondIds，继续影响原有核心盟约激活计算；编辑器会同步两类成员、抽选数量到旧字段供回退使用。

| tag | 规则 |
|---|---|
| all | 抽中即禁用所有持有它的角色 |
| normal | 联合检查角色持有的所有 normal 盟约，非空且全部抽中才禁用 |
| release | 抽中解除其成员禁用 |
| ignore | 不抽选，也不参与 normal 判定 |
| immune | 不抽选；持有它的角色永久免疫禁用 |

immune 与抽中的 release 优先于 all 和 normal。normal 盟约所在类别抽选数为 0、未归类或模式不可抽选时，它仍然阻挡联合禁用；须显式改为 ignore 才排除。

模式 active/inactive 名单继续限定抽选资格；旧 immuneBonds 继续排除抽选。禁用只影响供应，已拥有的角色仍可激活盟约和执行效果。

## 自动回退

缺少 classification，或新分类在解析、抽选、角色判定中出错，整套回退到原版 normal，忽略全部新类别及规则。旧 mode: banCore 也不独立生效。

回退独立读取原始赛季的旧字段，能解析的字段继续使用，缺失或非法字段逐项取服务器内置值。显式 0 和 [] 有效；数量必须为非负安全整数，名单必须为字符串数组，实际抽选过滤不存在、模式不可用和免疫的盟约。

| 旧字段 | 回退默认 |
|---|---|
| coreBondIds | yanShip、sargonShip、victoriaShip、kjeragShip、lateranoShip、egirShip、kazimierzShip、siracusaShip |
| minorBondIds | 赛季全部盟约排除核心及 immuneBonds |
| coreBondBanCount | act1: 2；act2: 3 |
| minorBondBanCount | act1: 2；act2: 4 |
| immuneBonds | act1: deputShip、emptyShip、visiShip；act2: suntShip、emptyShip、maniShip、investShip |

服务器沿用 season-defaults.ts：赛季包含 kazimierzShip 时选择 act2 表，否则 act1 表。

原版 normal 要求角色持有的全部盟约都被抽中；空集合不禁用。immuneBonds 只排除抽选，并非永久角色免疫。

新机制失败时丢弃部分新抽选结果，生成一次完整旧抽选结果；本局后续查询与房间恢复均保持该结果和 normal 判定，不反复重抽。商店候选扫描中出现回退会重新计算整批候选，避免混合两套规则。

解析问题以赛季诊断警告展示，原始上传 JSON 保留。运行时问题记录日志及实际回退配置来源；HTTP banStatus 可带 fallbackReason。不存在新配置时为正常兼容路径，不额外产生诊断。整个文件无效或缺少游戏必需数据仍按原有加载错误处理。

## 编辑器迁移与导出

盟约页面可管理类别、筛选、多选归类和批量设置规则；原 Ban 页面复用同一管理器。关闭分类后仍保留已同步的旧字段。

启用分类是显式操作：旧 normal 初始化为联合 normal；主动迁移旧 banCore 时，可抽选盟约初始化为 all，旧抽选免疫项初始化为 ignore，不转换成永久免疫。

新盟约默认为 normal，未归类时不会抽选。删除类别仅移除类别关系；默认两类不能删除。保存、协作和 JSON／目录导出保留分类数据；PE 导出同步移除不支持盟约在类别和规则中的引用。非法导入保留原始内容，提示回退，可显式从旧字段重新启用。

新配置需编辑器与游戏服务器同步升级；旧服务器不能完整执行新 tag 语义。
