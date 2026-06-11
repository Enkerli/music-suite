# Deployment & Serving Guide

## Why a Server is Required

This app uses **ES6 modules** (`import`/`export`), which browsers require to be served over HTTP due to CORS (Cross-Origin Resource Sharing) security policies. You cannot simply open `index.html` directly in a browser - you'll see a blank page with console errors.

## Local Development

### Option 1: Python Simple Server (Easiest)

```bash
# In the project root directory
python3 -m http.server 8000

# Then open: http://localhost:8000/docs/
```

### Option 2: npm Dev Server (with hot reload)

```bash
npm run dev

# Vite will start a dev server at http://localhost:5173
```

###  Option 3: Node http-server

```bash
npm install -g http-server
http-server docs/ -p 8000

# Then open: http://localhost:8000/
```

### Option 4: VS Code Live Server Extension

If using VS Code:
1. Install "Live Server" extension
2. Right-click on `docs/index.html`
3. Choose "Open with Live Server"

## GitHub Pages Deployment

### Step 1: Enable GitHub Pages

1. Go to your repository on GitHub
2. Click **Settings** → **Pages** (left sidebar)
3. Under "Build and deployment":
   - Source: **Deploy from a branch**
   - Branch: Select **main** (or your default branch)
   - Folder: Select **/docs**
4. Click **Save**

### Step 2: Wait for Deployment

GitHub will build and deploy your site. This takes 1-2 minutes. You'll see a green checkmark when ready.

### Step 3: Access Your Site

Your site will be available at:
```
https://<username>.github.io/<repository-name>/
```

For example:
```
https://enkerli.github.io/exquisite-fingerings/
```

## Building for Production

When you make changes to source files:

```bash
# Make changes in src/
# Then rebuild:
npm run build

# This outputs to docs/ which GitHub Pages serves
```

## Project Structure

```
exquisite-fingerings/
├── src/              # Source files (edit these)
│   ├── core/
│   ├── ui/
│   ├── assets/
│   └── index.html
├── docs/             # Built files (GitHub Pages serves this)
│   ├── index.html
│   └── assets/
├── tests/            # Unit tests
└── package.json
```

## Common Issues

### Issue: Blank page when opening index.html directly

**Solution**: Use a local server (see "Local Development" above)

**Why**: ES modules require HTTP protocol due to CORS security

### Issue: Changes not appearing

**Solution**: Rebuild after changes
```bash
npm run build
```

**Why**: Changes in `src/` don't automatically update `docs/`

### Issue: GitHub Pages shows old version

**Solution**: Clear browser cache or force-refresh (Ctrl+Shift+R / Cmd+Shift+R)

**Why**: Browsers aggressively cache static assets

### Issue: 404 on GitHub Pages

**Solution**: Check that:
1. GitHub Pages is enabled (Settings → Pages)
2. Branch is set to `main` (or your default)
3. Folder is set to `/docs`
4. The `docs/` folder exists in your repository

## Development Workflow

1. **Edit source files** in `src/`
2. **Run dev server** with `npm run dev` (auto-reloads on changes)
3. **Test changes** at http://localhost:5173
4. **Build for production** with `npm run build`
5. **Test built version** by serving `docs/` folder
6. **Commit and push** to GitHub
7. **GitHub Pages auto-deploys** from `docs/` folder

## Testing Workflow

```bash
# Run all tests
npm test

# Run tests in watch mode (re-runs on file changes)
npm test -- --watch

# Run tests with coverage
npm test -- --coverage
```

## MIDI Requirements

- **Browsers**: Chrome, Brave, Edge (WebMIDI API support required)
- **Not supported**: Safari, Firefox (no WebMIDI)
- **Fallback**: App works without MIDI, just can't send to hardware

## Browser Compatibility

| Feature | Chrome/Brave/Edge | Safari | Firefox |
|---------|-------------------|--------|---------|
| Grid Display | ✓ | ✓ | ✓ |
| Fingering | ✓ | ✓ | ✓ |
| Pattern Save/Load | ✓ | ✓ | ✓ |
| MIDI Output | ✓ | ✗ | ✗ |

Safari users get full functionality except MIDI output to hardware.

## Production Checklist

Before deploying:

- [ ] Run tests: `npm test`
- [ ] Build: `npm run build`
- [ ] Test locally: Serve `docs/` folder
- [ ] Check all features work
- [ ] Verify MIDI in Chromium browser
- [ ] Verify layout in Safari
- [ ] Test on mobile (iPad/phone)
- [ ] Commit and push
- [ ] Verify GitHub Pages deployment

## Mobile/Tablet Use

The app is responsive and works on tablets (especially iPads) but:
- **Portrait mode recommended** for best experience
- **Safari on iOS**: Full functionality except MIDI
- **Touch support**: All controls work with touch

## Future: Custom Domain

To use a custom domain with GitHub Pages:

1. Add a file named `CNAME` to `docs/` folder
2. Inside, put your domain: `fingerings.yourdomain.com`
3. Configure DNS to point to GitHub Pages
4. See: https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site
