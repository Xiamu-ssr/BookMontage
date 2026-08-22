# Seedance 2.5

Official source: [ByteDance Seed launch note](https://seed.bytedance.com/en/blog/one-take-creation-flexible-referencing-introducing-seedance-2-5).

- One generation can be up to 30 seconds and may contain multiple connected shots; use timestamped blocks such as `0–5s`, `6–12s`.
- References are roles, not attachments: state what each image/video/audio controls (character, scene, movement, voice, composition). It accepts up to 30 images, 10 videos, and 10 audio clips on ByteDance's product surface.
- For hard action, specify starting geography, path, scale, contact, consequence, and camera response. Allocate time to transitions; do not encode five transformations in one second.
- Use a clay/blocking reference when spatial paths matter. Use image references for identity and style. A 30-second direct generation does not require three arbitrary keyframes.
- Put dialogue and sound in the same timestamp block as the visible action. Preserve exact spoken text and assign speaker/voice.
- Prefer concrete motion and lens direction over adjectives. Request no subtitles or incidental text when unwanted.
- Check the current gateway schema before submitting: ByteDance capability does not prove a third-party endpoint exposes every reference or editing field.
