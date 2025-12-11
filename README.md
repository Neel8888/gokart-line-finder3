# GoKart Racing Line Finder

## Setup (local)
1. Install Node.js (LTS) on your Mac.
2. In the project root:
   ```bash
   npm install
   npm start       # dev server at http://localhost:3000
   ```
3. To build (for deployment):
   ```bash
   npm run build
   ```

## Deploy to Vercel
- Ensure `react-scripts` is in `dependencies` (this repo's package.json already includes it).
- Push repo to GitHub, then import into Vercel or use `vercel` CLI:
  ```bash
  npm i -g vercel
  vercel
  vercel --prod
  ```

## Notes
- Use Shift+click to add two calibration points for px→meter scaling.
- Auto-trace uses a Sobel heuristic — refine boundaries manually for better results.
