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

## Post-Flight
- [ ] Check "Diagnostics Export" works on production.
- [ ] Verify caching (Service Worker) works offline.
