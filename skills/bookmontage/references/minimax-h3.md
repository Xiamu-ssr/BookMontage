# MiniMax H3

官方资料：[MiniMax H3 仓库](https://github.com/MiniMax-AI/MiniMax-H3)、[官方提示词 Skill](https://github.com/MiniMax-AI/MiniMax-H3/tree/main/skills/h3-prompt-writing)

## 推荐写法

- 先选模式：T2VA 文本、I2VA 首帧、FL2VA 首尾帧、L2VA 尾帧、Ref2VA 多模态参考。
- 基础模式严格按 `integrated_multimodal_description`、`overall_soundscape`、`non_diegetic_music` 排列。
- Ref2VA 严格按 `subject_definitions`、`summary`、`retention_analysis`、`detailed_description`、`overall_soundscape`、`non_diegetic_music` 排列。
- 引用标签保持 `<Picture 1>`、`<Video 1>`、`<Audio 1>` 一致；逐镜头写构图、主体、环境、动作、镜头、声音和引用出现时间。
- 结构字段用英文；对白、歌词和画面文字保留原语言。总时间必须匹配 4–15 秒，优先写具体视听事件。

官方产品可接多张图片、视频和音频并同步生成立体声音频；ZenMux 是否透传首尾帧、完整 Ref2VA 或 2K 重绘需以接口为准。
