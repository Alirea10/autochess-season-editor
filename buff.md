# 自走棋 Buff Key 总览

> 数据来源：`packages/server/data/act2autochess.json` 中 `effectBuffInfoDataDict` 的全部 dispatch key。
> 这些 key 由方舟客户端 Torappu 引擎解析执行，编辑器仅维护其数据结构和参数。

---

## 一、装备类（装备时触发）

装备型效果（`effectType: "EQUIP"`），装备到干员身上时立即触发。

| Key | 效果 | 参数 | 说明 |
|---|---|---|---|
| `use_equip_reward_char_chess` | 拟态物质 | (无) | 装备时获得棋子 |
| `use_equip_reward_char_chess_bond_layer` | 随身身份牌 | `layer` | 装备时销毁，携带者所属盟约层数 +layer |
| `use_equip_reward_char_chess_with_same_bond` | 简易通讯机 | `count` | 获得同盟约棋子 |
| `use_equip_reward_random_char_chess_in_shop` | 紧急调度券 | `count` | 随机获得商店中的棋子 |
| `use_equip_reward_special_goods_char_chess` | 寻呼模块 | `choice_cnt`, `refresh_cnt` | 获得特殊商品棋子 |
| `use_equip_gain_coin_when_next_round_start` | 见钱眼开玩偶 | `count` | 下回合开始时获得金币 |
| `use_equip_recruit_new_char_and_give_char_to_player_most_bond` | 信标 | `choice_cnt`, `refresh_cnt` | 招募新干员并给予盟约最多的玩家 |
| `use_equip_upgrade_char` | 博士投影 | (无) | 装备时升级干员 |
| `equip_destory_deployment_cnt_change` | 人事部文档 | `count` | 装备销毁时改变部署数 |
| `equip_destory_gain_random_coin` | 骑士储蓄罐 / 盟约之币 | `min`, `max` | 装备销毁时获得随机金币 |
| `equip_round_start_upgrade_char` | 博士投影 | (无) | 装备回合开始时升级干员 |
| `equip_with_another_gain_coin_when_gain_char` | 天师古鼎 | `bond`, `count`, `max`, `other_equip` | 配合其他装备获得棋子时获得金币 |

---

## 二、环境 Buff（装备/盟约属性加成）

### 2.1 `env_gbuff_new_with_verify` — 装备属性 Buff

绝大多数装备的核心 buff，通过 blackboard 参数控制具体属性加成。使用量最大（124 个效果）。

| 参数 | 类型 | 说明 |
|---|---|---|
| `atk`, `atk_1`, `atk_2`, `atk_3` | number | 攻击力加成（多档位） |
| `atk_scale`, `atk_scale_1`, `atk_scale_2` | number | 攻击力百分比加成 |
| `atk_per_sec` | number | 每秒攻击力 |
| `atk_per_cnt` | number | 每层攻击力 |
| `atk_buff_cnt` | number | 攻击 buff 层数 |
| `max_hp`, `max_hp_1`, `max_hp_2`, `max_hp_3` | number | 最大生命值（多档位） |
| `max_hp_per_cnt` | number | 每层最大生命值 |
| `hp_ratio` | number | 生命值比例 |
| `def` | number | 防御力 |
| `attack_speed` | number | 攻击速度 |
| `ammo_percent` | number | 弹药百分比 |
| `damage`, `damage_scale` | number | 伤害/伤害倍率 |
| `damage_scale_minus` | number | 伤害减免 |
| `magic_resistance` | number | 法术抗性 |
| `magic_resist_penetrate` | number | 法术穿透 |
| `respawn_time` | number | 复活时间 |
| `max_respawn_cnt` | number | 最大复活次数 |
| `sp`, `init_sp` | number | 技力/初始技力 |
| `sp_recovery_per_sec` | number | 每秒技力恢复 |
| `sp_each_person` | number | 每人提供技力 |
| `addition_sp` | number | 额外技力 |
| `hp_recovery_per_sec_by_max_hp_ratio` | number | 基于最大生命值的每秒回血 |
| `stun` | number | 眩晕 |
| `cold` | number | 寒冷 |
| `disarmed_duration` | number | 缴械时长 |
| `lock_duration` | number | 锁定时长 |
| `undeadable_duration` | number | 不死时长 |
| `taunt_level` | number | 嘲讽等级 |
| `prob` | number | 概率 |
| `duration`, `interval` | number | 持续时间/间隔 |
| `max_cnt`, `max_buff_cnt`, `max_stack_cnt`, `max_trigger_cnt` | number | 最大计数/层数/触发次数 |
| `radius` | number | 范围半径 |
| `ex_interval`, `ex_max_hp` | number | 额外间隔/生命值 |
| `big_hammer`, `hammer_1`~`hammer_4` | number | 锤子参数（维式重锤系列） |
| `value`, `value_1`, `value_2`, `value_3` | number | 通用数值（多档位） |
| `bond_id`, `bond_type`, `bond_add_type` | string | 盟约限定/类型 |
| `equip_chess_id` | string | 关联装备 ID |
| `key` | string | 特殊标记 key |

**使用此 key 的装备（部分）：**
维式重锤系列、炎国短刀、坚守盾牌、歌利亚头盔、M3茧甲、双模机械臂、防暴盾、催泪瓦斯、伪装服、蜂鸣器、激光发射器、精准狙击镜、突袭手雷、谢拉格不融冰、萨尔贡浓茶、迅捷作战粮、有限加速器、不屈弹射器、铳骑之威、天师古鼎、蒸汽之心、海沟实验体、黄沙罗盘、耶拉冈德之泪、卡西米尔竞技旗、天马之枪、天马之盔、骑士戒律、叙拉古正装、家族徽章、源石溶剂、药枚实验、食腐之蝶、奥术法阵 等

### 2.2 `env_gbuff_new` — 盟约/全局属性 Buff

盟约系统触发、全局特殊选择触发的全局 buff。

| 参数 | 类型 | 说明 |
|---|---|---|
| 同 2.1 大部分参数 | — | 与 `env_gbuff_new_with_verify` 共享参数体系 |
| `fear` | number | 恐惧 |
| `damage_resistance` | number | 伤害抗性 |
| `no_attack_duration` | number | 不攻击持续时间 |
| `end_duration` | number | 结束持续时间 |
| `cd_duration` | number | 冷却时间 |
| `max_free_respawn_cnt` | number | 最大免费复活次数 |
| `ex_bond_char_cnt` | number | 额外盟约棋子数 |
| `ex_char_cnt` | number | 额外棋子数 |
| `ex_damage_scale_per_stack` | number | 每层额外伤害倍率 |
| `power_atk` / `power_attack_speed` / `power_sp` 等 | number | 力量相关参数 |
| `power_char_cnt` / `power_bond_char_cnt` / `power_bond_stack_cnt` | number | 力量棋子/盟约计数 |
| `weak[limit]` / `weak_duration` | number | 虚弱限制/时长 |
| `base_power_time` | number | 基础力量时间 |
| `range_radius` | number | 范围半径 |
| `filter_item_level` | number | 筛选装备等级 |
| `normal_sp` | number | 普通技力 |
| `invalid_in_band` / `valid_in_band` | string | 盟约有效/无效标记 |
| `enemy_exclude` | string | 排除敌人 |

**使用此 key 的效果：** 卡西米尔、维多利亚、萨尔贡、谢拉格、拉特兰、叙拉古、阿戈尔、炎 等盟约效果，以及不屈、助力、独行、精准、突袭、坚守、急行军、奥术、锐利、火力、灵巧、迅捷、绝技、协防干员、征召等全局效果

---

## 三、敌人/悬赏类

### 3.1 `add_enemy_kill_gain_coin` — 悬赏（击杀获得金币）

109 个效果使用，为最常见的悬赏 buff。

| 参数 | 说明 |
|---|---|
| `enemy_id` | 目标敌人 ID |
| `coin` | 击杀获得金币 |
| `count` | 需要击杀数量 |
| `round` | 生效回合 |

### 3.2 `add_enemy_selfbattle_win_gain_coin` — 战术特训

20 个效果使用。相比悬赏，需要战斗胜利才获得金币。

| 参数 | 说明 |
|---|---|
| `enemy_id`, `coin`, `count`, `round` | 同悬赏 |

### 3.3 `next_battle_add_enemy_win_gain_coin` — 下轮敌人胜利金币

1 个效果使用（无人机护障·P·战术特训）。

### 3.4 `enemy_attribute_add` — 敌人属性增加

6 个效果使用（排斥/裁决/责罚：脆弱/致幻）。

| 参数 | 说明 |
|---|---|
| `def` | 防御力加成 |
| `magic_resistance` | 法术抗性加成 |
| `enemy_level_type` | 敌人等级类型 |

### 3.5 `enemy_attribute_mul` — 敌人属性倍率

8 个效果使用（排斥/裁决/责罚：乏力，攻坚装备 I~III，补给线 I~II）。

| 参数 | 说明 |
|---|---|
| `atk` | 攻击力倍率 |
| `max_hp` | 最大生命倍率 |
| `enemy_exclude` | 排除敌人 |
| `enemy_level_type` | 敌人等级类型 |

---

## 四、盟约系统

| Key | 效果 | 参数 | 说明 |
|---|---|---|---|
| `bond_activated_add_layer` | 助力 | `bond`, `count`, `layer`, `more_layer` | 激活时盟约层数增加 |
| `bond_layer_added_reward_equip` | 维多利亚 | `count`, `layer`, `pool` | 盟约层数额外奖励装备 |
| `bond_layer_char_garrison_bonus` | 投资人 | `count`, `event`, `layer` | 盟约棋子驻军奖励 |
| `bond_layer_char_goods_price_bond_discount` | 远见 | `bond`, `discount`, `layer` | 盟约商品折扣（限盟约） |
| `bond_layer_char_goods_price_discount` | 远见 | `discount`, `layer` | 盟约商品折扣（通用） |
| `bond_layer_gain_coin` | 奇迹 / 远见 | `count`, `layer` | 盟约层数获得金币 |
| `bond_refresh_shop_next_free` | 奇迹 | `baseprob`, `prob`, `probk` | 盟约刷新下次免费 |
| `gain_bond_char_per_round` | 人才盲盒 | `bond`, `count`, `preround`, `round` | 每回合获得盟约棋子 |
| `other_bond_add_trigger_cnt` | 调和 | `count` | 其他盟约增加触发次数 |
| `prep_finish_char_bond_add_layer` | 重点监护 | `layer` | 准备完成棋子盟约层+1 |
| `refresh_shop_count_gain_coin_bond_char_chess` | 团伙行动 | `bond`, `max_count`, `refresh_count` | 刷新商店获得盟约棋子金币 |
| `sell_char_count_gain_equip_owner_bond` | 商业包装方案 | `count` | 出售棋子获得装备拥有者盟约 |
| `round_start_bond_check_gain_layer` | 文火慢炖 | `count1`, `count2`, `factioncount`, `round` | 回合开始盟约检查获得层数 |

---

## 五、回合触发类

| Key | 效果 | 参数 | 说明 |
|---|---|---|---|
| `gain_coin_when_round_start` | 精打细算玩偶 | `count` | 回合开始时获得金币 |
| `give_coin_in_round` | 得闲饮茶 | `coin`, `round` | 指定回合获得金币 |
| `coin_carry_over` | 利滚利 | `capital`, `interest`, `max` | 金币滚存（本金/利息/上限） |
| `round_start_activate_char_chess_effect_in_board` | 御守之力 | `count`, `event_type` | 回合开始在棋盘激活棋子效果 |
| `round_start_all_player_change_enemy_2` | "神秘顾客" | `count`, `enemylist`, `max`, `maxweight`, `min`, `minweight`, `round` | 回合开始所有玩家更换敌人 |
| `round_start_gain_char_chess_in_shop_every_n_round` | 九流之缘 | `count`, `round` | 每 N 回合商店获得棋子 |
| `round_start_gain_coin_by_bond_char_chess_buy` | 业务指标 | `bond`, `count`, `max_count` | 回合开始根据盟约棋子购买获得金币 |
| `first_buy_in_round_char_price_change` | 雪域礼赠 | `bond`, `price` | 回合首次购买价格变化 |
| `first_sell_char_chess_exchange_char_chess_in_shop` | 替身娃娃 | `count` | 回合首次出售棋子兑换商店棋子 |

---

## 六、准备阶段触发类

| Key | 效果 | 参数 | 说明 |
|---|---|---|---|
| `prep_start_gain_chess_from_pool_in_round` | 得闲饮茶 | `count`, `pool`, `round`, `type` | 准备开始从池子获得棋子 |
| `preparation_start_add_special_goods_every_n_round` | 见者有份 | `choice_cnt`, `count`, `pool`, `refresh_cnt`, `round`, `type` | 每 N 回合准备阶段添加特殊商品 |
| `preparation_start_gain_chess_every_n_round` | 加练！ | `chess`, `count`, `round`, `type` | 每 N 回合准备阶段获得棋子 |
| `preparation_start_gain_chess_from_round` | 集结指示 等（21 个） | `chess`, `count`, `round`, `type` | 准备阶段从回合获得棋子 |

---

## 七、全局特殊选择类

所有玩家共享的选择事件效果。

| Key | 效果 | 参数 | 说明 |
|---|---|---|---|
| `global_special_choice_all_activated` | 排斥/裁决/责罚（11 个） | (无) | 全局特殊选择全部激活标记 |
| `global_special_choice_bond_addlayer` | 各盟约盟誓（8 个） | `bond_list`, `count` | 全局选择盟约层数增加 |
| `global_special_choice_gain_coin` | 财富 | `count` | 全局选择获得金币 |
| `global_special_choice_gain_equip` | 列装 | `count`, `pool` | 全局选择获得装备 |
| `global_special_choice_prep_finish_bench_at_least` | 火力 | `count` | 全局选择准备完成替补席至少 N 个 |
| `global_special_choice_prep_finish_bench_at_most` | 锐利 | `count` | 全局选择准备完成替补席至多 N 个 |
| `global_special_choice_prep_finish_same_row_at_least` | 征召 | `count` | 全局选择准备完成同排至少 N 个 |
| `global_special_choice_refresh_free` | 补给 | `count` | 全局选择刷新免费 |

---

## 八、单个特殊选择类

| Key | 效果 | 参数 | 说明 |
|---|---|---|---|
| `single_special_choice_gain_bond_chess` | 各盟约驰援（8 个） | `bond`, `count` | 单人选择获得盟约棋子 |
| `single_special_choice_gloden_char_chess` | 升华 | `count` | 单人选择黄金棋子 |
| `single_special_choice_gloden_equip_chess` | 整备 | `count` | 单人选择黄金装备 |

---

## 九、商店操作类

| Key | 效果 | 参数 | 说明 |
|---|---|---|---|
| `up_shop_add_special_goods` | 定向投放 | `choice`, `count`, `pool` | 商店添加特殊商品 |
| `up_shop_next_refresh_must_present_bond_char` | 博学多通 | `bond`, `cnt`, `lvlist`, `price` | 下次刷新必定出现盟约棋子 |
| `band_coin_cost_gain_random_char_by_shop_level` | 通关奖励 | `coin_cnt`, `count` | 花费金币按商店等级获得随机棋子 |
| `band_cost_coin_reach_cnt_gain_chess_from_pool` | 定制铳械 | `coin_cnt`, `count`, `pool`, `type` | 花费金币达标从池子获得棋子 |
| `band_first_self_refresh_present_char` | 广交豪杰 | `bond`, `count` | 首次自刷新赠送棋子 |
| `band_shop_refresh_copy_max_lv_char` | 猎头顾问 | `count` | 商店刷新复制最高等级棋子 |

---

## 十、角色培养类

| Key | 效果 | 参数 | 说明 |
|---|---|---|---|
| `acbattle_shop_char_cultivate_effect` | 未精英化 / 精英阶段1 / 精英阶段2 / 精英阶段2-60级 | `atk`, `def`, `max_hp` | 精英化阶段属性加成 |
| `char_attribute_mul` | 同上 | `atk`, `def`, `max_hp` | 精英化属性倍率 |
| `char_chess_transformation_equip` | 突变细胞 | (无) | 棋子转化装备 |
| `char_dynamic_ability_new` | 叙拉古正装 / 耶拉冈德之泪 / 骑士戒律 | `at_root`, `atk_scale`, `atk_scale_ex`, `attack_speed`, `equip_chess_id`, `interval`, `key`, `move_speed` | 棋子动态能力（特殊机制） |
| `char_respawntime_mul` | 征召 | `scale` | 复活时间倍率 |

---

## 十一、地图/战场类

| Key | 效果 | 参数 | 说明 |
|---|---|---|---|
| `auto_chess_change_map` | 模拟战场演变（模式一~九）/ 外勤医疗 / 机械援助 | `cnt`, `common_condition` + 大量 `char_*#N` / `trap_*#N` 子参数 | 切换战场地图布局/机制 |

---

## 十二、Trap 特殊类

| Key | 效果 | 参数 | 说明 |
|---|---|---|---|
| `trap_copy_front_char` | 画卷 | (无) | 复制前方棋子 |
| `trap_create_self_choice` | "神秘顾客" / 教鞭 | `choice_event` | 创建自选陷阱事件 |
| `trap_disney_special` | "神秘顾客" | `count` | Disney 特殊机制 |

---

## 附录：统计

- **dispatch key 总数：** 约 60 个（不含 blackboard 参数）
- **使用最多的 key：** `env_gbuff_new_with_verify`（124 个效果）、`add_enemy_kill_gain_coin`（109 个效果）
- **blackboard 参数种类：** 约 150+ 个
- **最常见的 blackboard 参数：** `atk`、`max_hp`、`def`、`attack_speed`、`count`、`layer`、`prob`、`round`、`duration`、`bond`
