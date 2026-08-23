# 创作数据源

BookMontage 把“创作参考”与“正式资产”分开：数据源只负责返回可检查的标题、图片或视频链接、来源、提示词和热度等元数据；搜索不会偷偷下载。Harness 看过结果并决定保留后，才用 `stash` 放进本书的临时素材。

## Seedance 实片库

[Seedance 2 Prompts 中文站](https://seedance2prompts.com/zh) 是 BookMontage 的重点创作参考库：它把长提示词与真实成片放在一起，能直接观察 10 秒、15 秒和 30 秒作品的节奏、镜头密度、声音设计与可执行程度。它不是字节官方规范，但价值不低于规范——官方资料负责说明能力边界，实片库负责展示什么写法真的跑出过好结果。

## Harness 使用方法

先搜索相似成片，再读 1–3 条完整提示词，最后按当前角色、场景、剧情和官方语法重写；不要从空白提示词开始，也不要原样复制别人的角色或 IP。

```bash
npm run bookmontage -- prompt-search "仙侠 打斗" --model 2.5 --limit 5
npm run bookmontage -- prompt-search "仙侠 打斗" --model 2.0 --limit 2 --full
npm run bookmontage -- prompt-search "天宫" --model 2.5 --tag scifi-fantasy --kind r2v --min-images 5 --full
npm run bookmontage -- prompt-search --trending --model 2.5 --limit 6
npm run bookmontage -- prompt-search --author Soran --lang zh --sort newest --limit 10
npm run bookmontage -- prompt-facets --model 2.5 --lang zh
```

不写关键词时可以直接浏览筛选结果。默认 `--model all --lang all` 并返回短摘要；`--full` 返回完整提示词，`--refresh` 强制更新本地缓存。可重复或用逗号组合 `--tag`、`--author`、`--kind`；`--min-images` 筛选至少引用多少张图；`--trending` 只看当前趋势；`--sort` 支持相关度、最新和最早。`prompt-facets` 先列出当前模型/语言下可用的标签、提示词类型与作者计数。

每条结果同时返回版本、语言、标签、作者、日期、提示词类型、`@Image` 引用槽位和数量、成片、缩略图、案例页、原作者来源与许可证。站点明确标注为 2.5 的新案例归入 2.5，其余归入可用于 2.0 的经典库，与站点本身的版本筛选逻辑一致。

`npm run bookmontage -- prompt-search` 里的 `--` 是 npm 的“后续内容原样传给脚本”分隔符，`prompt-search` 是 BookMontage 子命令，因此不能写成 `--prompt-search`。

## 2.0 与 2.5 的提词复杂度

2.0 不是使用另一种更复杂的“语法”。两代的核心结构都是主体、动作、镜头、场景、光线、声音和时间轴。区别在于：

- 面对同一个目标，2.0 通常需要更明确的距离、动作接触、身份保持和禁止项，并把叙事收窄。
- 2.5 对参考素材、长时序和复合镜头的执行更强，所以同一任务可以少写一些“防御性重复”。
- 2.5 原生的 20–30 秒、多引用、分时段指令反而可能更长；这是因为任务更大，不是模型更吃啰嗦。

所以，2.5 不是“只换个更好的模型”：它可直接继承 2.0 案例，但多引用、长镜头、延长和时间轴类任务应优先学 2.5 原生案例。

## 数据来源

网站本身没有公开 Skill 或 CLI。BookMontage CLI 读取网站公开的结构化案例目录；其中包含站点当前的全文、标签、作者、日期、版本、引用槽位、成片与趋势列表，并只在 `.bookmontage/cache` 保存六小时短期缓存。数据仍注明来自 [YouMind OpenLab / Awesome Seedance 2 Prompts](https://github.com/YouMind-OpenLab/awesome-seedance-2-prompts)，许可证为 CC BY 4.0。

引用或改编案例时保留来源；模型大版本更新后，优先看同版本、最近发布且附实片的例子。

## 图片灵感库

先列出来源，再按目标检索：

```bash
npm run bookmontage -- source-list
npm run bookmontage -- source-search "中式 天宫 云海" --source meigen --model nanobanana --limit 8 --full
npm run bookmontage -- source-search "xianxia palace clouds" --source wallhaven --sort popular --atleast 2560x1440 --ratio 16x9 --limit 8
npm run bookmontage -- source-search "仙侠 女剑客" --source all --limit 6 --proxy http://127.0.0.1:7890
```

每条结果都含 `image_url`、`preview_url`、`page_url`、标题、来源说明，以及一段仅供 Harness 使用的 `stash` 参数。它不是已保存的资产。确定要保留时才执行：

```bash
npm run bookmontage -- stash "<result.stash.url>" --title "<result.stash.title>" --source "<result.stash.source>" --book <书籍选择器>
```

### MeiGen / NanoBanana Trending

[MeiGen](https://www.meigen.ai/) 的公开精选目录目前收录 1,446 条带成图的真实提示词，其中 1,148 条标注为 Nano Banana、298 条标注为 GPT Image。它适合研究“成图 + 提示词 + 作者 + 热度”的组合，尤其是海报、产品、摄影、插画与 3D 视觉；BookMontage 直接读取其 [NanoBanana Trending Prompts](https://github.com/jau123/nanobanana-trending-prompts) 结构化目录，并缓存六小时。

可用筛选：

- `--model all|nanobanana|gptimage`
- `--category "Illustration & 3D"` 等分类
- `--sort relevance|popular|newest|random`
- `--full` 返回完整提示词；默认只返回摘要

目录采用 CC BY 4.0，但链接到的图片仍保留各自创作者权利；引用时保留作者与原帖，正式生产前单独核对授权。其上游最近一次目录提交为 2026-04-29，因此它是高质量精选库，不应被描述为实时趋势榜。

### Wallhaven

[Wallhaven](https://wallhaven.cc/) 通过[官方 API](https://wallhaven.cc/help/api)提供壁纸搜索。BookMontage 默认只取 SFW 内容，并要求至少 `1920x1080`，适合寻找构图、色彩、环境气氛和大场景参考。

可用筛选：

- `--sort relevance|popular|newest|random`
- `--atleast 1920x1080` 最低分辨率
- `--ratio 16x9` 画面比例
- `--color 66ccff` 主色
- `--page 2` 翻页

Wallhaven 不等于“可任意商用素材库”。结果会保留作品页和原始来源；版权不明时只做内部构图参考，不把原图直接投入公开作品。

## 未自动接入的来源

- **ArtStation**：技术上可用 `gallery-dl` 下载，但其条款禁止未授权抓取与聚合，并对标记 `NoAI` 的内容明确限制生成式 AI 使用。BookMontage 不提供自动爬取；Harness 只能在人类提供具体页面后做单次审阅，并遵守作品授权。
- **Pixiv**：社区已有 `gallery-dl`、`PixivUtil2` 和 `PixivPy3`，但都依赖登录、OAuth 或非官方接口，稳定性和平台条款风险高。当前不内置；若以后接入，优先做“用户登录后的个人书签检索”，不做全站抓取。
- **WLOP / 鬼刀**：WLOP 会在 Pixiv 发布，但也长期使用微博、ArtStation、Patreon 与 Gumroad；Pixiv 不是唯一事实源。它更适合当顶级风格研究案例，而不是可复制的风格资产库。

## LoRA 的位置

LoRA 仍适合本地 ComfyUI、FLUX 或 Stable Diffusion 工作流：它能固化角色、服装、画风和世界观，并降低反复抽卡成本。但 BookMontage 当前以 ZenMux 上的 GPT Image / Seedream 等原生图像模型为主，这些 API 通常不接受用户自带 LoRA，所以 LiblibAI 的 LoRA 不是主生产链路。可以把其预览图和工作流当灵感来源，不能把 LoRA 当成所有云模型都能使用的通用角色资产。
