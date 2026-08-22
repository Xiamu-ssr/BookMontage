# 视频模型选择

BookMontage 当前保留 Seedance 2.5、Seedance 2.0 与 MiniMax H3。其余横评模型已经过实片淘汰，不再出现在生产手册和素材库中。

Gemini Omni Flash 已完成一次 5 秒有声实片，等待用户看画面与账单后裁定；Veo 3.1 的 5 秒请求被上游参数校验拒绝，尚无实片。两者都未进入生产候选。

## 实测价格

2026-08-22，同一组 5 秒、16:9、有声测试：

| 模型 | 实付 | 同规格 10 秒推算 |
| --- | ---: | ---: |
| Seedance 2.0 · 720p | `$0.736698` | `$1.473396` |
| MiniMax H3 · 768p | `$0.370000` | `$0.740000` |
| Gemini Omni Flash · 720p | API 用量估算约 `$0.5089`，待账单确认 | 不能据此承诺线性价格 |

10 秒价格是按同清晰度、同音频和同输入模式线性外推，不是套餐承诺。ZenMux 账单是最终事实源。

Gemini Omni 本次成功输出 5.013 秒、1280×720、24fps、H.264/AAC。API 返回 1,424 个输入 token 和 28,960 个视频输出 token；按模型页的 `$1.5/M` 输入、`$17.5/M` 输出机械计算约 `$0.5089`，请用 ZenMux 账单校准。Veo 3.1 的 5 秒请求在生成前被上游拒绝，当前图生视频只接受 4 / 6 / 8 秒，未自动重试。

## Seedance 2.5 的 30 秒实账

用户上一条 30 秒、1080p、有声 Seedance 2.5 实付约 `$17`。若只按像素面积线性折算，720p 为 1080p 的 `4/9`，同任务理论值约 `$7.56`。实际网关可能有分辨率档位、音频和参考素材费率，制作预算应按 `$8–10` 预留，最终仍以账单为准。

## Seedance 2.0 与 2.5

- ZenMux 当前标示 Seedance 2.0 为 `$2.353–7.5002 / M tokens`，Seedance 2.5 为 `$6.4–11.7 / M tokens`。
- 价格区间不能直接等同某条视频的成交价；清晰度、音频、视频输入和供应商档位会同时改变 token 数量或单价。
- 按相同档位比较（最低档对最低档、最高档对最高档），2.5 的 token 单价约为 2.0 的 `1.56–2.72 倍`；跨档位不能直接相除。
- 本次 2.0 的 5 秒 720p 有声片产生 `108,900 tokens`。若 2.5 生成完全相同数量的 tokens，按其当前公开区间估算：5 秒约 `$0.697–1.274`，10 秒约 `$1.394–2.548`。这不是实付，仍需一笔 2.5 账单校准。

## 成本规律

- 时长：同一档位内近似线性。5 秒翻到 10 秒约为两倍，不是指数增长；极短任务可能受最小计费或取整影响。
- 分辨率：明显影响成本。视频 token 通常随帧数和画面像素量增长，因此 1080p 不只是比 720p 多 50%；像素面积是 `2.25 倍`。网关可能再叠加档位系数，不能机械保证恰好 2.25 倍。
- 帧率：若模型或接口允许改变，通常也近似线性影响生成量；ZenMux 当前 Seedance 原生接口没有把帧率列为用户字段。
- 音频与输入模式：有声、参考视频或复杂多模态输入可能进入不同费率档。

官方资料：[ZenMux Seedance 2.5](https://zenmux.ai/bytedance/doubao-seedance-2.5)、[ZenMux Seedance 2.0 对比页](https://zenmux.ai/compare?model=bytedance%2Fdoubao-seedance-2.0%3Avolcengine)、[ZenMux 视频接口](https://zenmux.ai/docs/api/zenmux/generate-videos-native.html)、[火山引擎 Seedance 2.0](https://www.volcengine.com/activity/seedance2)、[MiniMax H3](https://github.com/MiniMax-AI/MiniMax-H3)
