# 星穹铁道排轴可视化工具

本工具使用 Wails 框架，结合React进行开发。开发目的是为了方便崩坏·星穹铁道的玩家在进行高难本挑战之前，预先对自己的轴进行排演，以便互相交流、分享。

Wails 桌面图标以根目录 `appicon.png` 为源文件，并在构建前自动同步到 `build/appicon.png`。

网页公共静态资源位于 `static/`；角色头像保存在 `static/favicon/`，可使用 `pnpm run download:favicons` 根据 `src/data/characters.json` 补齐或更新。

## 开发检查与 Wails 绑定

`pnpm check` 是提交前的统一检查入口，包含 TypeScript、角色数据、文档路径、Wails 绑定、架构依赖、Go 格式/测试/vet、lint、格式和全量测试。

测试按运行环境和职责拆分：`pnpm run test:node` 执行领域、数据、模拟器和集成测试，`pnpm run test:ui` 执行 jsdom 组件测试，`pnpm run test:quality` 执行稳定的性质与契约测试，`pnpm run test:performance` 单独执行性能基准。性能基准使用固定场景，不属于普通 `pnpm check` 门禁；若修改模拟器核心，应在本地单独运行并记录结果。

新增角色时，先在 `src/data/characters.json` 增加基础角色目录数据，并在 `src/data/characterMechanics.json` 增加技能/机制配置，再通过 `pnpm run check:data` 校验；随后在 `src/mechanics/` 增加机制实现，必要时通过 `src/simulate/mechanics/registry.ts` 注册生命周期钩子，最后在 `tests/unit/mechanics/` 或 `tests/integration/simulation/` 增加行为测试。角色身份和 CID 统一从 `src/domain/identity/characterId.ts` 查询，技能输入统一经过 `src/domain/skills/skillCode.ts` 解析。

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
