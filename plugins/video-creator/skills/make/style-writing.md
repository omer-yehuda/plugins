# Writing in a style (screenwriter and style-artist)

`style.json` in the project folder is the style. The helper adds its `look` and `finish` to every prompt by code, word for word, plus your `character` and `world`. So shot prompts never repeat style words: translate the CONTENT into the style.

- **character**: one sentence, 20 to 45 words, built on the style's `character` hint. Fix what a model must repeat: body shape, face or head shape, hair, two outfit colours, one signature item. No recurring person? Describe the recurring object or creature.
- **world**: one sentence, 15 to 35 words: place, era, light, time of day, weather.
- **shot prompt**: 15 to 60 words: subject, action, framing (close-up, medium, wide), angle, one specific detail. Use the style's vocabulary: in a voxel style a tree is "a square tree of leaf blocks"; in claymation a river is "a ribbon of blue plasticine"; in pixel art a fire is "a four-frame flickering pixel flame". Call the main character "the character".
- **motion**: 8 to 30 words for image-to-video models, one motion, in the style's `motion` manner.
- Set `cast: false` on shots without the main character.
- Stay inside the style's `negative` list. No words, letters, signs, logos, speech bubbles or UI ("an unreadable glowing sign" if one must exist). No artist, studio, game or brand names.
