import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Dev only: serve /api/* with the Netlify functions so `npm run dev` works without the Netlify CLI.
// Server-side keys are read from .env (no VITE_ prefix) and never reach the bundle.
const FUNCTIONS = { '/api/msds': '/netlify/functions/msds.mjs', '/api/ai': '/netlify/functions/ai.mjs', '/api/admin': '/netlify/functions/admin.mjs' }

const devFunctions = (mode) => ({
  name: 'dev-netlify-functions',
  configureServer(server) {
    const env = loadEnv(mode, process.cwd(), '')
    // process.env stringifies undefined to "undefined", so copy only keys that exist.
    for (const key of ['KOSHA_API_KEY', 'GEMINI_API_KEY', 'ADMIN_PIN']) {
      if (env[key] && !process.env[key]) process.env[key] = env[key]
    }
    for (const [route, file] of Object.entries(FUNCTIONS)) {
      server.middlewares.use(route, async (req, res) => {
        const { default: handler } = await server.ssrLoadModule(file)
        const chunks = []
        for await (const chunk of req) chunks.push(chunk)
        const request = new Request(`http://${req.headers.host}${req.originalUrl}`, {
          method: req.method,
          headers: req.headers,
          body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks),
        })
        const response = await handler(request)
        res.statusCode = response.status
        res.setHeader('Content-Type', response.headers.get('Content-Type') || 'application/json; charset=utf-8')
        res.end(await response.text())
      })
    }
  },
})

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    tailwindcss(),
    react(),
    devFunctions(mode),
  ],
}))
