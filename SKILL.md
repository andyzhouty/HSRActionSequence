---
name: hsr-action-sequence
description: 使用或扩展 HSRActionSequence 的排轴与伤害计算能力，读取配装、复现行动轴、接入角色与装备机制、开发通用伤害计算、搜索策略并导出可复核结果。适用于本仓库的计算、开发与自定义维护任务。
---

# HSRActionSequence Agent 指南

本文随项目维护，供 Agent 在操作本仓库前读取。路径均相对仓库根目录；先定位包含 `package.json`、`src/` 与本文件的目录。入口和用户操作见 [README](README.md)，具体机制按需读取下方文档。当前伤害元数据版本从 `src/data/damageMetadata.json` 读取，不把历史试算数值当作当前结论。

项目会持续扩展到通用伤害计算。本文中的白厄、银狼欢愉队和对应接口记录的是当前实现，不限定后续开发范围。收到新角色、新队伍或通用计算需求时，检查现有公共能力并实现所需扩展，不把现有专用引擎的限制视为项目永久边界，也不将尚未实现的能力宣称为已经可用。

## 先选择正确的计算入口

|任务|入口|重要区别|
|---|---|---|
|公共伤害公式|`src/damage/formula.ts`、`src/damage/elationFormula.ts`|复用常规/欢愉伤害乘区；公式函数本身不等于完整的角色与战斗模拟器|
|手动排轴、插入Q、角色机制与资源备注|`src/simulate/actions.ts` 的 `simulateActions`|生成排轴页行动；不等于已经计算伤害|
|白厄队伤害|`src/damage/phainonTrial.ts` 的 `calculatePhainonTrial`|回放已有轴，调用前应用 `getDisplayOrderedActions`；显式限定要统计的行动值窗口|
|银狼欢愉队伤害|`src/damage/elationTeam.ts` 的 `simulateElationTeam`|根据配装、策略和随机种子独立生成轴，不回放手动技能锚点|
|欢愉队策略搜索|`src/damage/elationSearch.ts` 的 `searchElationAxis`|固定配装与机制，只搜索支持的策略参数；浏览器线程池在 `elationSearchClient.ts`|
|白厄离线搜索|`src/damage/optimizer.ts` 的 `searchPhainonAxis`|与欢愉队搜索的输入、状态和支持范围不同|

修改手动排轴机制不一定会改变独立伤害模拟。先确认问题在哪个引擎，再决定是否需要同步修复。

## 扩展角色与通用伤害计算

- 先把需求拆成配装属性、技能倍率与伤害类型、命中/目标规则、资源变化、增益生效与到期、行动与触发顺序，再核对哪些已有公共实现。
- 通用公式、属性与资源结算尽量复用；角色特有状态放入对应机制或适配模块。新队伍不必强行塞入白厄或银狼专用引擎，应按需求扩展公共计算上下文、调度和事件接口。
- 将角色、队伍、等级和技能的适用条件与通用校验分开。现有“80级、必须包含银狼”等条件只属于当前专用入口，不能直接复制为新通用引擎的约束。
- 保留逐次伤害与资源的可追踪来源，兼顾自然回合、额外回合和触发攻击的差异。调整公共接口时验证旧存档迁移与已有角色的结果，避免另建一套与实际结算不同的展示算法。
- 通用接口落地或旧入口迁移后，同步更新本文的入口表、README支持范围和对应回归测试，使Agent能发现新的能力。

## 读取配装与建立配置

1. 区分文件类型：FreeSR 原始配装包含 `avatars`、`lightcones`、`relics`；排轴存档包含 `characters` 及可选 `phainonDamageTrial` / `elationTeamTrial`；原始计算结果是另一种文件，不能直接当作配装导入。
2. 排轴存档先经过 `toNormalizedSavedData`；欢愉配置先经过 `normalizeElationTeamConfig`。不要用类型断言代替校验。
3. 用户要算自己的配装时，保留文件星魂、光锥、叠影、主副词条、技能、强化状态与初始资源。先复制数据，再应用用户明确要求的覆盖；导出覆盖后的配置供复核。
4. `readTrialEquipment(raw, cids)` 可按角色CID读取原装备。`createElationTeamPreset` 的最后一项 `preserveEquipment` **默认仍为 false**，兼容旧验证脚本；网页已显式传 true。调用它计算用户原配装时须传 true，否则会替换部分星魂与光锥。
5. 当前欢愉引擎要求80级、四名不同角色且包含银狼LV.999。支持角色CID为1506、1502、8010、1217、1501、1511、1503；藿藿伤害入口仅接受强化版本。光锥和套装也须在已实现范围内；遇到缺失数据应指出缺项，不静默替换或按零收益处理。

例如，计算用户原配装的狼、火、虚、真队，可在受版本控制的实验脚本中使用：

```ts
import { readTrialEquipment } from "../../src/damage/equipment";
import { simulateElationTeam } from "../../src/damage/elationTeam";
import {
  defaultElationTeamConfig,
  normalizeElationTeamConfig,
} from "../../src/damage/elationTypes";

// raw 为读取并解析后的完整 FreeSR 文件；以下战斗条件只是示例。
const config = normalizeElationTeamConfig({
  ...defaultElationTeamConfig,
  enabled: true,
  profiles: readTrialEquipment(raw, ["1506", "1501", "1511", "1503"]),
  sourceFile: "用户配装",
  ahaBaseSpeedRule: "starInParty",
  limit: 300,
  enemyLevel: 95,
  enemySpeed: 205,
  enemyCount: 1,
  resistance: 0.2,
  ahaDebt: false,
});
if (!config) throw new Error("缺少欢愉队设置");
const result = simulateElationTeam(config);
```

示例不代替当前用户的敌速、抗性、负债或配装要求。导出可供网页读取的存档时，把配置放入 `elationTeamTrial`，同时提供 `characters: config.profiles.map(p => p.character)`，再经存档归一化；不要把裸配置或结果JSON标成“可导入行动轴”。

## 已实现角色的结算与实验口径

以下规则在任务涉及对应机制时使用；其他角色应核对其技能与数据，不能直接套用角色专属规则。

- **笑点每次变动后立即向下取整**，不累计尾数。银狼隐藏分及累计产笑使用实际整数收益；不能只把显示值取整。参见 [整数规则](docs/integer-jokes.md)。能量、暴击期望和抵御池不因此一并取整。
- 常规A/E无特殊说明分别基础回20/30能量；受击回能吃回能效率，描述明确为“固定回能”的来源不吃效率。特殊资源不能套用常规能量规则。
- 银狼Q先扣60隐藏分，再结算进状态收益；例如158先变98，再获得40时为138。不要只计收益而漏掉消耗。
- 火花“目标3大奖”是停手策略，不是每轮必得3大奖；每轮3大奖25小奖无放回、最多20抽、7抽保底，开场保底4、跨轮继承，资源耗尽可提前停止。
- 额外回合、自然回合与协同/附加攻击不能混为一类。真珠额外回合不重置自然行动计时，不消耗虚照境界持续回合；临时笑点结束清理不倒扣已获得的隐藏分。
- 概率模型和待实测机制与操作策略分开。不要为提高伤害而顺便改变盲盒概率、复制好活来源、负债或暴击口径。当前概率实现见 `src/damage/silverWolfBox.ts` 与配置默认值；群内讨论过的候选公式不等于已经上线。
- 说明等级、目标数、抗性、敌速、群攻频率及每次回能。无弱点不能自动当作0抗性；若用20%抗性近似，应写明。不要在用户给定抗性后再额外套一遍“无弱点减伤”。
- “总词条40”“速度最多25条”等是具体试算约束，不是全项目默认限制。优化词条时保留未授权修改的主词条、套装和装备，核对主副词条互斥、单件升级次数与总预算。词条系数读取 `damageRelicAffixes.json`，计算中不提前四舍五入。

## 搜轴、统计与完整轴输出

1. 明确优化目标：单次种子、平均伤害、P95或全暴击上限是不同目标。通常先用共同种子粗筛，再用不重叠种子复核候选及基准；资源状态和随机分支相关，不能把单轮概率简单独立相乘。
2. 网页搜索目前是有限参数的坐标搜索，不穷举任意逐次技能序列，也不自动优化遗器配速。离线扩展搜索须明确变量范围、预算及约束，结果称为“当前搜索范围内较优候选”。
3. 导出统计时记录完整配置、代码提交或规则版本、种子起点、样本数、百分位定义。现有试算用升序样本下标 `floor(N × p)` 读取分位数；比较时保持定义一致。
4. 用户要“P95的完整轴”时，找到该分位数对应的实际种子并重跑，不能把平均轴或默认种子冒充P95。保留同AV事件的真实顺序；操作表可合并一次攻击的弹射，但完整结果必须保留盲盒、抽奖、回能与资源事件。
5. 至少导出归一化存档、完整结果JSON和可阅读的轴/报告。验证操作分组覆盖全部事件、分段伤害总和与 `result.total` 一致，注明暴击期望、负债开关及取整口径。计算产物放在被忽略的 `build/<task>/`，不提交用户原始配装。
6. `tests/experiments/` 中有按环境变量启用的试算，可能依赖本机 `build/` 或指定账号文件；先读入口、断言和变量再运行，例如 `pnpm exec vitest run --project node tests/experiments/elationMaxAxisSearch.test.ts` 还需设置该文件声明的开关及输入。新增依赖个人配装的实验也应显式门控，确保普通测试不依赖账号文件。历史固定数值遇到模型修正后须重新核验，不为凑旧结果修改机制。

## 修改代码与更新数据

- 按需读取 [白厄](docs/damage-trial.md)、[欢愉队](docs/elation-team-trial.md)、[火花](docs/sparxie-trial.md)、[虚照](docs/star-aha-damage.md)、[真珠](docs/pearl-damage.md)、[后台搜索](docs/elation-browser-search.md)。长文可能保留历史假设，以最新用户确认、当前代码和回归验证处理冲突，并修订过期说明。
- 模拟器不依赖React或Wails。界面使用已有引擎；Worker和直接调用必须结算一致。角色CID与技能码分别使用 `src/domain/identity/characterId.ts`、`src/domain/skills/skillCode.ts` 的公共入口。
- 新角色排轴需要目录、机制配置和实现，见 `src/data/characters.json`、`src/data/characterMechanics.json`、`src/mechanics/`；新增排轴支持不代表已经有伤害支持。
- 技能、星魂、行迹及光锥元数据来自 HSRVersionInspector；遗器词条参考 ProjectHyacine。二者可能位于WSL的用户目录，先确认路径，不把Windows的 `~` 当成WSL的 `~`。
- 重新提取数据使用 `scripts/extractDamageMetadata.mjs` 和 `scripts/extractFreeSrSpeedMetadata.mjs`。两个脚本的覆盖范围不同；新增角色/光锥先检查提取清单，并核对 `damageMetadata.json`、`freesrSpeedMetadata.json` 及相关目录的一致性。
- 调整Go公开方法后用Wails重新生成 `frontend/wailsjs`，不要手改生成绑定。静态资源在 `static/`；桌面图标源为根目录 `appicon.png`。

## 验证与交付

运行与改动匹配的测试，修核心机制补事件顺序、资源守恒或伤害来源的回归。开发命令见README；干净检出通常先运行 `pnpm build`，再运行 `pnpm run check:ci`。`pnpm check` 还依赖被忽略的本机文档目录，见README中的说明。模拟器核心变更另跑 `pnpm run test:performance`。文档改动只需校验技能格式、路径和差异，无需为文案补实现镜像测试。

查看 `git status`，保留其他未提交工作；按文件选择本次改动，默认不夹带本机交接文档、临时结果或账号数据，用户明确要求分享时按指定范围处理。维护自定义版本时，检查当前分支、远程仓库和上游更新；合并前核对差异，保留本地定制，解决冲突后运行相关验证，不用重置或覆盖工作区代替合并。用户要求“先审阅后提交”时，先交付文件与验证结果，等审阅确认后再commit/push。推送 `main` 会触发GitHub Pages部署；只有发布属于已授权任务时才推送，并在发布后确认部署结果。不要将“提交成功”写成“已上线”。
