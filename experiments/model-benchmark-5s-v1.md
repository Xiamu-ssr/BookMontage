# 5 秒模型横评 · 待人类确认

## 统一输入

- 参考图：`.bookmontage/assets/71833c166aaf4e0ca53e28c00793e35a0001.png`
- 规格：5 秒、16:9、720p、有声、单个候选、不自动重试。
- 目标：测角色稳定、明显位移、多人空间关系、接触反馈、运镜和声音；不追求完整剧情。
- 统一内容：小雷音寺废墟中，天庭巡官抬起木牍施压；小猪妖向上跃起并挥拳，金色经文沿手臂点亮；巡官用半透明云纹屏障挡住，撞击产生一圈冲击波，碎石向外滑动。镜头从低机位快速上摇跟随，在撞击处停住。保留其余三名小妖在后景，人物不增不减，不切镜，不出现字幕。

## 候选与预计费用

| 模型 | 5 秒预计 | 备注 |
| --- | ---: | --- |
| `minimax/minimax-h3` | `$0.37–0.59` | 官方有专用提示词 Skill；本轮首选 |
| `skyreels/skyreels-v4` | `$0.60–0.70` | 原生音画；公开资料以论文/模型卡为主 |
| `pixverse/v6` | 约 `$0.60` | 通用叙事；720p 有声按官方积分比例估算 |
| `pixverse/c1` | 约 `$0.65` | 偏动作和多镜头；720p 有声按官方积分比例估算 |

`sapiens-ai/agnes-video-v2.0` 仅约 `$0.025/5 秒`，已有样片足以确认质量下限，本轮不重复烧一次。`google/gemini-omni-flash-preview` 按输出 token 计价且未进入 ZenMux 公开原生视频接口表，暂不混入同一横评。

## MiniMax H3 提示词

```text
integrated_multimodal_description:
Use <Picture 1> as the exact first frame and preserve the identity, clothing, count, and spatial placement of all five characters. A continuous five-second low-angle action shot inside the ruined Little Thunderclap Temple. The celestial inspector above raises his wooden ledger and presses one palm downward. The pig demon in the foreground bends his knees, launches roughly six meters upward, and drives one fist toward the inspector; glowing golden sutra glyphs ignite sequentially from his shoulder to his knuckles. The inspector opens a translucent cloud-pattern shield. The fist makes visible contact with the shield, producing one expanding circular pressure wave; loose stones slide radially across the floor and the three companions recoil but remain in the background. The camera tilts up rapidly with the pig demon, then brakes and holds on the exact impact. One continuous take, no cuts, no extra characters, no subtitles, no body duplication.

overall_soundscape:
Cracking stone at launch, a rising cloth rush, one heavy magical impact, low cloud resonance, and brief debris scatter. No dialogue.

non_diegetic_music:
Tense Chinese percussion and low strings, restrained under the impact sound.
```

## SkyReels V4 提示词

```text
以图片1作为精确首帧，保持五名角色的身份、服装、数量和站位。5秒，16:9，单镜头。小雷音寺废墟内，空中的天庭巡官抬起木牍并向下压掌；前景小猪妖屈膝后向上跃起约六米，挥拳冲向巡官，金色经文从肩膀依次点亮至拳锋。巡官展开半透明云纹屏障，拳头必须与屏障发生清晰接触，撞击产生一圈扩散冲击波，地面碎石向外滑动，后景三名同伴受风压后退但不消失。镜头从低机位高速上摇跟随小猪妖，在撞击瞬间急停。保持一个连续镜头，不增加角色，不复制肢体，不生成字幕。同步声音：起跳碎石声、衣料破风声、一次沉重法力撞击与低沉云鸣；配乐为克制的中国鼓和低弦。
```

## PixVerse V6 提示词

```text
Use Image 1 as the first frame. Preserve all five characters exactly. One continuous 5-second low-angle shot in the ruined temple: the inspector raises the wooden ledger and presses one palm down; the pig demon jumps about six meters upward and punches toward him as golden sutra marks ignite along his arm. The inspector forms a translucent cloud-pattern shield. Show a clear fist-to-shield contact, one expanding shock ring, and loose stones sliding outward. The three companions remain in the background and recoil from the pressure wave. The camera tilts up fast with the jump and stops at impact. No cuts, no new characters, no duplicate bodies, no subtitles. Native audio: stone crack, cloth rush, one heavy magical impact, low cloud resonance, restrained Chinese drums and low strings.
```

## PixVerse C1 提示词

```text
Image 1 is the exact opening frame and identity reference. Five-second cinematic action, one continuous shot. The celestial inspector raises his wooden ledger and pushes one palm downward. The pig demon explosively launches six meters upward and drives a single punch at him; golden scripture symbols light from shoulder to fist. The inspector creates a translucent cloud shield. The fist visibly hits the shield and compresses it before a circular shockwave bursts outward, moving loose stones and forcing the three background companions one step back. Low-angle camera rapidly cranes upward with the pig demon and hard-stops on contact. Preserve every character, costume and position; no cuts, morphing, clones, subtitles or additional people. Synchronized stone crack, air rush, deep impact, cloud resonance and restrained xianxia percussion.
```

只有人类确认本文件后才提交任务；远端失败也不自动重试。
