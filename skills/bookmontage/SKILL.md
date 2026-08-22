---
name: bookmontage
description: "操作本地 BookMontage 故事世界：通过 CLI 查看或修改书籍、全局资产、章节、镜头、依赖与视频候选。用于创建或维护保存在 .bookmontage 中的长篇 AI 视频项目。"
---

# BookMontage

SQLite 是唯一事实源。不要手改 `public/generated/library.json`，它只是随时可以重建的展示缓存。

1. 修改前运行 `npm run bookmontage -- list`，再用 `show <id|slug|path>` 定位对象。
2. 保留人的初稿：可读叙事写入 `story`，给模型的指令写入 `body`，资产依赖全部保存为 `link`；不要向镜头复制资产数据。
3. 用 `revise <id> <patch.json>` 修订。ID 只有一个字段：32 位十六进制身份加 4 位版本号。
4. 完成后运行 `export` 和 `verify`。Warning 表示上游资产已有新版本，依赖镜头需要复核。
5. 付费生成必须先经人确认。使用 `generate <shot-id>`，生成物先作为候选片等待审核。

世界关系也使用同一张 `link` 图。用 `links <对象>` 查看双向关系，`relate <源> <kind> <目标>` 新增有向关系，`unlink <源> <kind> <目标>` 删除；不要复制角色、阵营或道具数据。

写模型提示词时，只读取当前模型对应的说明：[Seedance 2.5](references/seedance-2.5.md)、[Seedance 2.0](references/seedance-2.0.md)、[MiniMax H3](references/minimax-h3.md)、[PixVerse V6 / C1](references/pixverse-v6-c1.md)、[SkyReels V4](references/skyreels-v4.md)、[Agnes Video 2.0](references/agnes-video-2.md) 或 [Gemini Omni Flash](references/gemini-omni-flash.md)。没有第一方提示词手册的模型只能记录为模型卡，禁止把社区经验标成官方规则。
