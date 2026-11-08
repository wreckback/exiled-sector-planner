// The planner's version, shown in the summary panel's footer next to the mod's.
// "dev" here in the repository: tools/package.ps1 writes the release tag into each zip's copy, and tools/serve.ps1
// answers this file with `git describe` (the latest tag, plus commits since) when serving locally.
window.PLANNER_VERSION = 'dev';
