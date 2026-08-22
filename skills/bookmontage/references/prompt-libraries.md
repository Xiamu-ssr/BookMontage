# Seedance 实片库

[Seedance 2 Prompts 中文站](https://seedance2prompts.com/zh) 是 BookMontage 的重点创作参考库：它把长提示词与真实成片放在一起，能直接观察 10 秒、15 秒和 30 秒作品的节奏、镜头密度、声音设计与可执行程度。它不是字节官方规范，但价值不低于规范——官方资料负责说明能力边界，实片库负责展示什么写法真的跑出过好结果。

## Harness 使用方法

先搜索相似成片，再读 1–3 条完整提示词，最后按当前角色、场景、剧情和官方语法重写；不要从空白提示词开始，也不要原样复制别人的角色或 IP。

```bash
npm run bookmontage -- prompt-search "仙侠 打斗" --limit 5
npm run bookmontage -- prompt-search "仙侠 打斗" --limit 2 --full
```

默认返回短摘要；`--full` 返回完整提示词，`--refresh` 强制更新本地缓存，`--lang en` 切换英文目录。结果同时保留成片链接、来源与许可证。

## 数据来源

网站本身没有公开 Skill 或 CLI，但它链接了一份持续更新的开源目录：[YouMind OpenLab / Awesome Seedance 2 Prompts](https://github.com/YouMind-OpenLab/awesome-seedance-2-prompts)。BookMontage CLI 从这份 CC BY 4.0 目录读取，并只在 `.bookmontage/cache` 保存短期缓存。

引用或改编案例时保留来源；模型大版本更新后，优先看同版本、最近发布且附实片的例子。
