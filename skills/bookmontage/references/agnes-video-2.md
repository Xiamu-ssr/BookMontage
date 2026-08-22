# Agnes Video 2.0

资料：[ZenMux 模型页](https://zenmux.ai/sapiens-ai/agnes-video-v2.0)

ZenMux 描述它支持文生视频、图生视频、多图和关键帧动画，标价约 `$0.005/秒`。本轮接口实测表明，多图会进入 keyframes 语义，不能当作 H3/Seedance 那样的“角色图 + 场景图”自由引用；单图 I2V 才是稳定的降级路径。

目前没有找到可核验的 Sapiens AI 第一方提示词手册，所以这里只记录接口能力，不称为官方技巧。实测结果已表明它适合极低成本占位预演，不适合作为动作质量基准或最终成片模型。
