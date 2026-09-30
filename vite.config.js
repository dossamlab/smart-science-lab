import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Dev only: serve /api/msds with the Netlify function so `npm run dev` works without the Netlify CLI.
// The key is read server-side from .env (KOSHA_API_KEY, no VITE_ prefix) and never reaches the bundle.
const msdsDevApi = (mode) => ({
  name: 'msds-dev-api',
  configureServer(server) {
    process.env.KOSHA_API_KEY ??= loadEnv(mode, process.cwd(), '').KOSHA_API_KEY
    server.middlewares.use('/api/msds', async (req, res) => {
      const { default: handler } = await server.ssrLoadModule('/netlify/functions/msds.mjs')
      const response = await handler(new Request(`http://localhost/api/msds${req.url}`))
      res.statusCode = response.status
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.end(await response.text())
    })
  },
})

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    tailwindcss(),
    react(),
    msdsDevApi(mode),
  ],
}))
