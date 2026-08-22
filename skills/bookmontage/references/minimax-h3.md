# MiniMax H3

官方资料：[MiniMax H3 仓库](https://github.com/MiniMax-AI/MiniMax-H3)、[官方提示词 Skill](https://github.com/MiniMax-AI/MiniMax-H3/tree/main/skills/h3-prompt-writing)、[模型说明](https://www.minimax.io/blog/minimax-h3)

- 时长为 4–15 秒；原生同步生成立体声音频，官方产品最高支持 2K。
- 先选模式：T2VA（文本）、I2VA（首帧）、FL2VA（首尾帧）、L2VA（尾帧）或 Ref2VA（多模态参考）。
- 基础模式按顺序填写 `integrated_multimodal_description`、`overall_soundscape`、`non_diegetic_music`。
- Ref2VA 使用 `subject_definitions`、`summary`、`retention_analysis`、`detailed_description`、`overall_soundscape`、`non_diegetic_music`；保持 `<Picture 1>`、`<Video 1>`、`<Audio 1>` 标签稳定。
- 结构使用英文，台词、歌词与画面文字保留原语言。
- 明确构图、主体、环境、动作、镜头、声音和参考素材出现的准确时间。具体物理事件比“电影感、唯美”更有效。
- 第三方网关可能只开放部分输入字段。使用首尾帧或完整参考能力前，先检查它的请求结构。
