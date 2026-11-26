---
name: manifest
description: Moved. Customs is now part of the skill-installer plugin. Use ONLY when the user runs /customs:manifest or says "customs check". Points to /skill-installer:manifest.
---

# Customs has moved

Customs now lives inside the **skill-installer** plugin, with the same scanner and officer, and it now gates every skill install too.

Tell the user, in two lines:

1. This command moved to `/skill-installer:manifest`.
2. Install it with `/plugin install skill-installer@omer-plugins`, then uninstall this one with `/plugin uninstall customs@omer-plugins`.

If skill-installer is already installed, offer to run `/skill-installer:manifest` with the same argument now. Do not scan anything from this stub.
