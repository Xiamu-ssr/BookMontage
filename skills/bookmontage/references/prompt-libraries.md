# Seedance 实片库

[Seedance 2 Prompts 中文站](https://seedance2prompts.com/zh) 是 BookMontage 的重点创作参考库：它把长提示词与真实成片放在一起，能直接观察 10 秒、15 秒和 30 秒作品的节奏、镜头密度、声音设计与可执行程度。它不是字节官方规范，但价值不低于规范——官方资料负责说明能力边界，实片库负责展示什么写法真的跑出过好结果。

## Harness 使用方法

先搜索相似成片，再读 1–3 条完整提示词，最后按当前角色、场景、剧情和官方语法重写；不要从空白提示词开始，也不要原样复制别人的角色或 IP。

```bash
npm run bookmontage -- prompt-search "仙侠 打斗" --model 2.5 --limit 5
npm run bookmontage -- prompt-search "仙侠 打斗" --model 2.0 --limit 2 --full
npm run bookmontage -- prompt-search "仙侠 打斗" --model all --limit 5
```

默认 `--model all`，返回短摘要；`--full` 返回完整提示词，`--refresh` 强制更新本地缓存，`--lang en` 切换英文目录。结果同时返回 `model`、成片链接、来源与许可证。站点将明确标注为 2.5 的新案例归入 2.5，其余归入可用于 2.0 的经典库，与站点的版本筛选逻辑一致。

`npm run bookmontage -- prompt-search` 里的 `--` 是 npm 的“后续内容原样传给脚本”分隔符，`prompt-search` 是 BookMontage 子命令，因此不能写成 `--prompt-search`。

## 2.0 与 2.5 的提词复杂度

2.0 不是使用另一种更复杂的“语法”。两代的核心结构都是主体、动作、镜头、场景、光线、声音和时间轴。区别在于：

- 面对同一个目标，2.0 通常需要更明确的距离、动作接触、身份保持和禁止项，并把叙事收窄。
- 2.5 对参考素材、长时序和复合镜头的执行更强，所以同一任务可以少写一些“防御性重复”。
- 2.5 原生的 20–30 秒、多引用、分时段指令反而可能更长；这是因为任务更大，不是模型更吃啰嗦。

所以，2.5 不是“只换个更好的模型”：它可直接继承 2.0 案例，但多引用、长镜头、延长和时间轴类任务应优先学 2.5 原生案例。

## 数据来源

网站本身没有公开 Skill 或 CLI，但它链接了一份持续更新的开源目录：[YouMind OpenLab / Awesome Seedance 2 Prompts](https://github.com/YouMind-OpenLab/awesome-seedance-2-prompts)。BookMontage CLI 从这份 CC BY 4.0 目录读取，并只在 `.bookmontage/cache` 保存短期缓存。

引用或改编案例时保留来源；模型大版本更新后，优先看同版本、最近发布且附实片的例子。
