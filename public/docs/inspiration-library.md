# 灵感库维护手册

灵感库是跨书籍的私人视觉参考库。人类负责寻找和粘贴图片；Harness 负责逐张理解、命名、归类与补全元数据。图片文件只保存一份。

## 两级分类

- 一级分类记录来源、作者或长期合集，例如 `WLOP`、`中式天庭`。
- 二级分类记录反复出现的角色、地点或视觉主题，例如 `翠眸黑纱女王`、`天宫长廊`。
- 没有足够证据时可以暂不归类，不创建“未分类”占位项。

身份不确定时使用稳定的视觉代号，不猜测官方角色名。

## 详细描述

“详细描述”是 Harness 观察图片后写出的反向提示词，不冒充图片的原始 Prompt。它应让后续创作模型在没看原图时，也能理解这张图的关键视觉信息。

一段完整描述通常依次说明主体与姿态；脸、头发和可识别标记；衣着剪裁、层次、材质、颜色与纹样；首饰、武器、工具、灵宠和附属物；前中后景、建筑、地貌、天气与尺度；最后补充光线、色盘、景别、视角、景深和渲染质感。

只写可见事实。无法确认时使用“像”“疑似”“可能为”，不编造剧情和官方设定。作者姓名不是生产用风格咒语，应改写为可见的光影、色彩、材质和构图特征。

## 标签

类型标签可以多选，也可以不选：

- `角色`：主体足以支撑角色设计。
- `场景`：环境或建筑足以独立复用。

普通标签记录可检索的具体特征，例如 `绿色眼睛`、`黑色薄纱`、`云海`、`巨物奇观`，不堆叠同义词。

## Harness 命令

```bash
npm run bookmontage -- inspiration-list --category WLOP
npm run bookmontage -- inspiration-search "银发 白羽" --category WLOP --type 角色 --limit 8
npm run bookmontage -- inspiration-search "云海 巨物奇观" --type 场景 --full
npm run bookmontage -- inspiration-update <素材ID> --category WLOP --subcategory 翠眸黑纱女王 --title 黑纱正面设定 --types 角色 --tags 绿色眼睛,黑色薄纱 --description-file /tmp/description.txt
npm run bookmontage -- export
npm run bookmontage -- verify
```

元数据修订会产生同一 UUID 的新版本，旧版本保留用于追溯。

`inspiration-search` 只搜索已保存到私人灵感库的图片，范围包括标题、两级分类、类型、标签和详细描述；结果带绝对文件位置。默认返回短摘要，加 `--full` 返回完整详细描述。联网找新图使用 `source-search`，不会与私人库混在一起。
