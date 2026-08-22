# Seedance 2.0

官方资料：[火山方舟提示词指南](https://www.volcengine.com/docs/82379/2222480?lang=zh)、[ByteDance Seed 发布说明](https://seed.bytedance.com/en/blog/seedance-2-0-%E6%AD%A3%E5%BC%8F%E5%8F%91%E5%B8%83)

实片参考：[Seedance 2 Prompts 中文站](https://seedance2prompts.com/zh)。用 `bookmontage prompt-search <关键词> --full` 调取同类型长提示词，再结合当前资产改写。

## 推荐写法

- 先判定任务：文生、首帧、首尾帧、多模态参考、编辑或延长；不要把“编辑原视频”误写成“参考原视频”。
- 先写空间层：主体、环境、相对位置、构图；再写时间层：动作顺序、转场、节奏和声音。
- 每个主体始终使用同一称呼。多张素材逐一说明主体、场景、动作、运镜、风格或声音职责。
- 台词保留原语言，并同时写说话者、音色、时间点和口型同步；动作、环境音与音乐放在对应时间段。
- 复杂空间关系优先提供分镜、路径或动作参考，不用长篇形容词替代可观察动作。

## ZenMux

模型名 `bytedance/doubao-seedance-2.0`。网关公开支持 480p / 720p / 1080p、最长 10 秒与同步音频；这是当前网关暴露范围，不等于原厂全部能力。

接口资料：[ZenMux 原生视频接口](https://zenmux.ai/docs/zh/api/zenmux/generate-videos-native.html)
