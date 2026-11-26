---
name: inspect
description: Moved. Customs is now part of the skill-installer plugin. Use ONLY when the user runs /customs:inspect or says "customs check". Points to /skill-installer:inspect.
---

# Customs has moved

Customs now lives inside the **skill-installer** plugin, with the same scanner and officer, and it now gates every skill install too.

Tell the user, in two lines:

1. This command moved to `/skill-installer:inspect`.
2. Install it with `/plugin install skill-installer@omer-plugins`, then uninstall this one with `/plugin uninstall customs@omer-plugins`.

If skill-installer is already installed, offer to run `/skill-installer:inspect` with the same argument now. Do not scan anything from this stub.
