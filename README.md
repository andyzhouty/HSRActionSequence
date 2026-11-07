# 星穹铁道排轴可视化工具

本工具使用 Wails 框架，结合React进行开发。开发目的是为了方便崩坏·星穹铁道的玩家在进行高难本挑战之前，预先对自己的轴进行排演，以便互相交流、分享。

Wails 桌面图标以根目录 `appicon.png` 为源文件，并在构建前自动同步到 `build/appicon.png`。

网页公共静态资源位于 `static/`；角色头像保存在 `static/favicon/`，可使用 `pnpm run download:favicons` 根据 `src/data/characters.json` 补齐或更新。

## 开发检查与 Wails 绑定

`pnpm check` 是提交前的统一检查入口，包含 TypeScript、角色数据、文档路径、Wails 绑定、架构依赖、Go 格式/测试/vet、lint、格式和全量测试。

测试按运行环境和职责拆分：`pnpm run test:node` 执行领域、数据、模拟器和集成测试，`pnpm run test:ui` 执行 jsdom 组件测试，`pnpm run test:quality` 执行稳定的性质与契约测试，`pnpm run test:performance` 单独执行性能基准。性能基准使用固定场景，不属于普通 `pnpm check` 门禁；若修改模拟器核心，应在本地单独运行并记录结果。

新增角色时，先在 `src/data/characters.json` 增加基础角色目录数据，并在 `src/data/characterMechanics.json` 增加技能/机制配置，再通过 `pnpm run check:data` 校验；随后在 `src/mechanics/` 增加机制实现，必要时通过 `src/simulate/mechanics/registry.ts` 注册生命周期钩子，最后在 `tests/unit/mechanics/` 或 `tests/integration/simulation/` 增加行为测试。角色身份和 CID 统一从 `src/domain/identity/characterId.ts` 查询，技能输入统一经过 `src/domain/skills/skillCode.ts` 解析。

JSON 导入支持 FreeSR 的 `freesr-data.json`。文件中的角色会全部导入，请自行删除不属于当前队伍的角色。速度根据行迹、遗器和可确认的光锥常驻效果计算；缺少必要数据或无法确认光锥效果时速度留空，需手动填写。速度所用行迹和光锥元数据摘自 HSRVersionInspector 4.6.54，遗器词条与套装系数参考 ProjectHyacine；新增角色或光锥时需要同步更新 `src/data/freesrSpeedMetadata.json`。

页面下方新增白厄伤害试验，可单独导入 FreeSR 中白厄、布洛妮娅、花火、知更鸟的当前配装并生成验证轴；伤害设置随普通 JSON 保存。支持白厄0–2魂、布洛妮娅0–4魂、花火0魂（含强化技能组）、知更鸟0–1魂，以及首个验证配置中的四把光锥和遗器套装。试验只统计白厄自身的常规伤害，按6级普攻起步；未包含协奏附加伤害、队友伤害、击破、Boss阶段和战斗祝福。详细范围与数据更新方法见 [伤害试验说明](docs/damage-trial.md)。

模拟器代码位于 `src/simulate/`，不依赖 React 或 Wails；UI 通过 `src/infrastructure/backend/port.ts` 定义的后端端口访问桌面能力，测试可注入 fake。保存数据必须经过版本迁移、归一化和 schema 校验后才能进入模拟器。

修改 `main.go` 中 `App` 的公开方法后，使用 Wails 重新生成 `frontend/wailsjs`：

```text
wails generate module
```

生成目录只允许由 Wails 生成流程更新；`pnpm run check:bindings` 会检查 `main.go` 与 `App.d.ts`、`App.js` 的方法集合是否一致。

## 项目

- 图标：
  ![图标](https://andyzhouty.github.io/hsrlab/favicon.jpg)
- 项目当前用来Vibe Coding的AI: GPT 5.6 Luna XHigh

## 目前支持的特殊逻辑

- 白厄：Q开境界，境界内特殊行动（基础速度取角色数据与光锥加成），可手动结束大招
- 姬子·启行：助战技F支持
- 鸭/花/日：E单体拉条，日支持拉条召唤物
- 鸟：Q群体拉条
- 记忆主：右键迷迷拉条
- 昔涟：全部诗篇已完成
- 流萤——完全燃烧
- 阿格莱雅
- 银狼lv999
- 刻律——军功已基本完成
- 遐蝶
- 风堇
- 爻光
- 火花
- 长夜月
- 盾丹
- 绯英
- 知更鸟·晴歌（水鸟）：E召唤晴空乐手，Q单体立即行动+禁拉其他我方，Fever状态
- 砂金·戏浪（水砂）：热意积累与阈值触发欢愉技，阿哈时刻加速，强化欢愉技

银狼欢愉队的实验性300AV伤害计算已接入排轴页，支持指定四人配装导入、资源账本、可复现盲盒采样与完整明细导出。使用方法和模型边界见 `docs/elation-team-trial.md`。

## 网页伤害计算

排轴页下方提供两个伤害试验入口，均可导入 FreeSR 配装并导出计算明细，技能数据版本为4.6.54：

- 白厄队：布洛妮娅、花火或刻律德菈、知更鸟的增益与能量联动，包含刻律德菈奇袭。范围见[白厄伤害试验](docs/damage-trial.md)。
- 银狼欢愉队：银狼LV.999、爻光、欢愉主、强化藿藿，以及可替换导入的火花、虚照（星神★阿哈）、真珠。支持资源账本、概率采样和100个随机种子统计；范围见[欢愉队试验](docs/elation-team-trial.md)、[火花](docs/sparxie-trial.md)、[虚照](docs/star-aha-damage.md)、[真珠](docs/pearl-damage.md)。

这些入口按已实现的队伍与机制计算，不代表支持任意角色组队。欢愉队使用独立自动行动轴；欢愉队已提供[网页后台自动搜轴](docs/elation-browser-search.md)，支持并行计算、取消、独立种子复核与一键应用候选。

网页计算区已整理为「选队并导入 → 设置战斗 → 查看结果或搜轴」，支持欢愉队与白厄队页签、默认保留原配装和折叠高级选项。点击顶部「伤害计算」即可进入，详见[操作说明](docs/damage-workflow.md)。
