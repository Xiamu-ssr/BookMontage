# Gemini Omni Flash Preview

官方资料：[Gemini Omni 使用手册](https://ai.google.dev/gemini-api/docs/omni)、[模型卡](https://ai.google.dev/gemini-api/docs/models/gemini-omni-flash)

## 推荐写法

- 先选任务：`text_to_video`、`image_to_video`、`reference_to_video` 或 `edit`；通过 Interactions API 生成和继续修改。
- 首帧使用 `<FIRST_FRAME>`；身份或风格参考使用零起始的 `<IMAGE_REF_0>`。多图时可在 Sources / References 段明确每张图的职责。
- 单镜头明确写 `In a single continuous shot` 和 `No scene cuts`；用自然时间或 `[0-3s]` 时间码安排动作。
- 声音直接写进提示词；视频默认带音频。简单负向限制写在正文中，当前接口不支持独立 negative prompt。
- 编辑时只描述本轮增量变化，并写 `Keep everything else the same`；用 `previous_interaction_id` 延续上一轮。
- 官方完整评测语言是英文，因此生产提示词结构优先英文，中文对白保持中文。

当前模型输出 3–10 秒、720p、24fps 视频。它的 “Omni” 指原生接受文本、图片和视频上下文并输出有声视频，还能对话式迭代；不是“什么内容格式都能输出”的通用聊天模型。

网关资料：[ZenMux Interactions API](https://zenmux.ai/docs/api/vertexai/create-interaction-native.html)
