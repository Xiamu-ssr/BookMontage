# Veo 3.1

官方资料：[Google Cloud Veo 3.1 提示词指南](https://cloud.google.com/blog/products/ai-machine-learning/ultimate-prompting-guide-for-veo-3-1/)、[Google DeepMind Prompt Guide](https://deepmind.google/models/veo/prompt-guide/)

## 推荐写法

- 按 `[Cinematography] + [Subject] + [Action] + [Context] + [Style & Ambiance]` 组织，不用堆砌同义形容词。
- 镜头部分明确景别、视角、运动和焦段感觉；动作写连续因果；环境写空间与光；声音、对白和音乐写进正文。
- 图生视频先说明从输入首帧开始，之后只写需要发生的变化。多人一致性任务优先 ingredients / reference images，而不是只靠人名。
- 使用英文提示词；可把不希望出现的对象放进独立 negative prompt，但不要使用模糊的否定长句。

ZenMux 文档写 720p / 1080p、5 或 8 秒及同步音频；但 2026-08-22 实际向 `veo-3.1-generate-001` 提交 5 秒图生视频时，上游明确返回只支持 `4 / 6 / 8 秒`。以运行时校验为准，5 秒请求不会进入生成。

网关资料：[ZenMux Vertex 视频接口](https://zenmux.ai/docs/api/vertexai/generate-videos.html)
