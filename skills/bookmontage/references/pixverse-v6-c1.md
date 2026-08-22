# PixVerse V6 / C1

官方资料：[PixVerse C1 文档](https://docs.platform.pixverse.ai/c1-2067883m0)、[PixVerse 价格表](https://docs.platform.pixverse.ai/pricing-796039m0)、[ZenMux V6 模型页](https://zenmux.ai/pixverse/v6)

## 怎么选

- V6 是通用型：文生视频、图生视频、首尾帧、Fusion 参考和延长，适合日常叙事与生活场景。
- C1 偏电影动作与多镜头：官方接口支持文本、图片、首尾帧、Fusion 参考、分镜面板和同步音频，时长 1–15 秒，最高 1080p。它强调高速跟拍、打斗接触、破坏、物理运动和 VFX，但不支持视频延长。

## 提示词

- 先选 T2V、I2V、Transition 或 Fusion，不要让一张图片同时充当首帧和身份参考。Fusion 通过 `image_references` 传入，不应假设 API 会直接理解人类写的 `@图片名`。
- 提示词上限 5000 字符；写清主体、动作链、镜头、场景、音效和结束状态。
- 动作测试优先 C1；角色稳定与普通镜头先试 V6。公平对比时保持同一首帧、5 秒、720p、有声。

## 价格方向

- ZenMux V6 标价约 `$0.05–0.46/秒`，C1 约 `$0.06–0.24/秒`，具体取决于清晰度与音频。
- PixVerse 官方积分表中，720p 有声每秒：V6 为 12 credits，C1 为 13 credits；1080p 有声分别为 23 与 24 credits。
