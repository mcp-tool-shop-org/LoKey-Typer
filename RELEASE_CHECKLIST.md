# Release Checklist

## Pre-Flight
- [ ] **Version Bump**: Update `version` in `package.json`.
- [ ] **Changelog**: Add entry to `CHANGELOG.md` with date.
- [ ] **Build**: Run `npm run build` locally to ensure no compilation errors.
- [ ] **Tests**: Run `npm test` and ensure all pass.
- [ ] **Type Check**: Run `npm run typecheck` (tsc).
- [ ] **Diagnostics**: Open `AudioDiagnosticsPage` and verify "Audio Context: Running".
- [ ] **Daily Set**: Verify `Daily Set` generates deterministically (refresh page, same set).
- [ ] **Migrations**: Verify `Settings` load correctly (no crashes on old data).

## Deployment (GitHub Pages)
1. Push to `main`.
2. Create a git tag: `git tag v1.1.0`.
3. Push tag: `git push origin v1.1.0`.
4. Verify GitHub Action completes.
5. Visit the text site.

## Post-Flight Smoke Test (2 minutes)
1. **Cold Load**: Open root URL. Confirm render & console clean.
2. **Deep Link**: Open `/LoKey-Typer/settings` directly. Confirm no 404.
3. **Audio Feel**: Type 10 keys. Confirm first key hits instantly (Prewarm) and ambient dips (Ducking).
4. **Hard Refresh**: Refresh on a sub-route. Confirm audio assets load (no WAV 404s).
5. **Diagnostics**: Confirm "Recover Audio System" works and Export downloads JSON.

