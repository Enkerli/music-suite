# plugin-shells/ — STAGING, not the permanent home

C++ plugin shells live in their own repos (HANDOFF §2 — deliberate
structure). A shell lands here only when the session that built it could
not create its GitHub repo (the integration lacks repo-creation rights),
so the work survives the ephemeral build environment.

**To promote `workspace-plugin/`:** create `Enkerli/workspace-plugin` on
GitHub, copy this directory's contents there, add the foundation submodule
(`git submodule add https://github.com/Enkerli/enkerli-juce.git`), push,
then delete the staged copy here. Its README carries the build steps; it
was configure+build-verified on Linux (LV2/Standalone/CLAP) from exactly
these files on 2026-07-20.
