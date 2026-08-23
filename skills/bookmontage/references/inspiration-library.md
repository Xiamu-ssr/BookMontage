# 灵感库维护手册

灵感库是跨书籍的私人视觉参考库。人类负责寻找和粘贴图片；Harness 负责逐张理解、命名、归类与补全元数据。SQLite 是唯一事实源，图片文件只保存一份。

## 层级

- 一级分类：来源、作者或长期合集，例如 `WLOP`、`中式天庭`。
- 二级分类：一级分类内部反复出现的角色、地点或视觉主题，例如 `翠眸黑纱女王`、`天宫长廊`。
- 素材：具体图片。素材只引用一个二级分类；没有足够证据时可以暂不归类，禁止创建“未分类”占位分类。

同一张关系图里可以出现多个主体，但分类要选择未来最可能被检索和复用的核心主体。身份不确定时使用稳定的视觉代号，不猜测官方角色名。

## 详细描述

字段名固定为 `detailed_description`，界面显示“详细描述”。它不是图片原始生成提示词，而是 Harness 根据可见事实写出的反向提示词：目标是让后续创作模型在没看原图时，也能理解这张图值得复用的视觉信息。

按图片实际内容写成一段连贯中文，通常覆盖：

1. 主体类型、数量、年龄感、性别呈现、体型与姿态。
2. 脸型、五官、肤色、瞳色、发色、发型、发饰与可识别标记。
3. 衣着的层次、剪裁、开口、长度、廓形、材质、颜色、纹样和连接方式。
4. 首饰、武器、工具、灵宠、动物、法宝与其他附属物。
5. 前景、中景、背景、建筑、地貌、天气、时间和空间尺度。
6. 主光方向、冷暖关系、色盘、构图、景别、视角、景深与可见的渲染质感。

“详细”指可重建的视觉结构，不是堆叠“唯美、震撼、电影感”等形容词。复杂角色图或多人场景通常写到约 350–650 个汉字：不能只说“穿红衣”，还要写清外层与内搭、领口和袖型、开口位置、衣片如何连接、纹样落在哪里、布料如何反光；不能只说“云上宫殿”，还要写清建筑在画面中的方位与层级、人物和建筑的比例、桥梁或柱列如何延伸、前中后景如何遮挡。简单图片可以更短，但删掉原图后仍应能据此重建主体、空间、光线与材质的主要决策。

只写看得见的内容。遮挡、身份或材质无法确认时使用“像”“疑似”“可能为”，不要编造剧情、作者意图或官方设定。不要把作者姓名当成生产提示词里的风格咒语；应描述可见的光影、色彩、材质和构图。

## 标签

`types` 是可选的多选特殊标签，目前只使用：

- `角色`：人物或生物主体足以支撑角色设计。
- `场景`：环境、建筑或空间设计足以独立复用。

一张图可以同时属于两类，也可以都不选。`tags` 是普通自由标签，写可检索的具体特征，例如 `绿色眼睛`、`黑色薄纱`、`云海`、`巨物奇观`；不要重复标题和分类名，也不要堆同义词。

## 图鉴型素材

古籍异兽、器物图录等素材除视觉描述外，还可以保存：

- `summary`：条目简介，回答“它是什么”。
- `source_text`：可靠版本的原文，不改写。
- `plain_text`：Harness 根据原文独立写出的白话解释。
- `source_page`：画像出处页。
- `text_source_page`：原文出处页。
- `rights`：素材权利状态或使用限制。

这些字段解释“对象是什么”，`detailed_description` 仍只负责“这张参考图具体长什么样”。现代受版权保护的绘本、译注与博主插画不能因为被网页展示就批量复制；优先使用公有领域古籍原文和古版画像，白话解释由 Harness 独立撰写。

## Harness 操作

```bash
npm run bookmontage -- inspiration-list --category WLOP
npm run bookmontage -- inspiration-search "银发 白羽" --category WLOP --type 角色 --limit 8
npm run bookmontage -- inspiration-search "云海 巨物奇观" --type 场景 --full
npm run bookmontage -- inspiration-import image.png --category WLOP --subcategory 翠眸黑纱女王 --title 黑纱正面设定 --types 角色 --tags 绿色眼睛,黑色薄纱 --description-file /tmp/description.txt
npm run bookmontage -- inspiration-update <素材ID> --category WLOP --subcategory 翠眸黑纱女王 --title 黑纱正面设定 --types 角色 --tags 绿色眼睛,黑色薄纱 --description-file /tmp/description.txt
npm run bookmontage -- inspiration-import old-print.png --category 山海经 --subcategory 九尾狐 --title '九尾狐 · 古图' --types 角色 --description-file /tmp/visual.txt --summary-file /tmp/summary.txt --source-text-file /tmp/original.txt --plain-text-file /tmp/plain.txt --source-page <画像网址> --text-source-page <古籍网址> --rights 'Public domain'
npm run bookmontage -- export
npm run bookmontage -- verify
```

元数据修订会产生同一 UUID 的新版本，旧版本保留用于追溯。整理完成后必须导出展示缓存并验证文件与引用。

`inspiration-search` 只查本地私人库，检索范围包括标题、一级/二级分类、类型、标签和详细描述；默认返回短摘要，加 `--full` 才返回完整详细描述。返回值中的 `path` 是绝对文件位置，可直接交给 Harness 或图像模型。互联网数据源仍使用 `source-search`，两者不混库。
