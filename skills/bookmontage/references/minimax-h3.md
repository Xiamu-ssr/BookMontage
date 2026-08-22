# MiniMax H3

Official sources: [MiniMax H3 repository](https://github.com/MiniMax-AI/MiniMax-H3), [official prompt-writing Skill](https://github.com/MiniMax-AI/MiniMax-H3/tree/main/skills/h3-prompt-writing), and [model note](https://www.minimax.io/blog/minimax-h3).

- Use 4–15 seconds. H3 generates video and native stereo audio together; the official product describes up to 2K output.
- Pick the mode first: T2VA (text), I2VA (first frame), FL2VA (first+last), L2VA (last frame), or Ref2VA (multimodal references).
- Base modes use, in order: `integrated_multimodal_description`, `overall_soundscape`, `non_diegetic_music`.
- Ref2VA uses: `subject_definitions`, `summary`, `retention_analysis`, `detailed_description`, `overall_soundscape`, `non_diegetic_music`. Keep `<Picture 1>`, `<Video 1>`, and `<Audio 1>` labels stable.
- Write structure in English, but keep dialogue, lyrics, and visible text in their original language.
- Describe composition, subject, environment, action, camera, sound, and exact reference timing. Concrete physical events beat “cinematic” or “beautiful”.
- A third-party gateway may expose fewer inputs than the open model. Verify its request schema before assuming first/last-frame or full-reference support.
