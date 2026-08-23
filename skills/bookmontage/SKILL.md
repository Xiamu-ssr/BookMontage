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

标记为 `copyright_sensitive: true` 的素材只能研究，禁止发送给生产模型。同一角色有多张已审核图片时优先使用 `primary: true` 的主图；CLI 会过滤版权敏感图，并把主图排在参考序列前面。

世界关系也使用同一张 `link` 图。用 `links <对象>` 查看双向关系，`relate <源> <kind> <目标>` 新增有向关系，`unlink <源> <kind> <目标>` 删除；不要复制角色、阵营或道具数据。

网络调研素材放进“临时素材”，不要伪装成正式角色资产。使用 `stash <url> --title <名称> --source <来源页面>` 下载到 `.bookmontage/tmp`；图片、GIF、视频和文档都可保存。确认采用后再生成正式 `asset`，并用 `derived_from` 指回临时素材。

构思角色、场景或镜头前，先用 `source-list` 查看可用图像来源，再用 `source-search [关键词] --source <meigen|wallhaven>` 检索。结果只返回标题、图片链接、原页面、提示词和热度等元数据，不会自动写入项目。Harness 必须先审视结果；只有决定保留时，才把结果中的 `stash.url` 交给 `stash`。默认把图片当视觉参考，不默认拥有复制、训练或商用权利。

写提示词时，只读取当前模型对应的说明：[Seedance 2.5](references/seedance-2.5.md)、[Seedance 2.0](references/seedance-2.0.md) 或 [MiniMax H3](references/minimax-h3.md)。同一叙事目标可以共用，但必须按目标模型的官方结构重新编译，禁止原样发送同一版。

Seedance 生产任务不要从空白开始。先用 `bookmontage prompt-facets` 看可用标签，再用 `bookmontage prompt-search [关键词] --model <2.5|2.0>` 按标签、作者、趋势、提示词类型和引用图片数量检索 [创作数据源](references/prompt-libraries.md)，看 1–3 条目标版本的同类型成片与完整长提示词，再结合官方手册、当前资产和人类草稿重写。给 2.5 制作时先看 2.5 原生案例；若没有合适结果，再参考已验证的 2.0 案例并升级其引用、时间轴和声音设计。社区案例是高价值实证，不冒充官方规则，也不原样复制他人角色或 IP。
