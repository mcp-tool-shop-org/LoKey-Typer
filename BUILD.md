# Build Instructions

## Prerequisites
- Node.js 18+
- npm 9+

## Setup
Install dependencies:
```bash
npm ci
```

## Development
Run the local dev server:
```bash
npm run dev
```

## Production Build
Create a production-ready build in `dist/`:
```bash
npm run build
```

This command runs TypeScript validation (`tsc -b`) and the Vite build process.

## Testing
Run unit tests:
```bash
npm test
```

## Content Validation
Verify content packs and rotation logic:
```bash
npm run validate:content
npm run smoke:rotation
```
