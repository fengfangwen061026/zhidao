import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import os from 'node:os'

function getLanIp() {
  const nets = os.networkInterfaces()
  for (const entries of Object.values(nets)) {
    for (const net of entries || []) {
      if (net && net.family === 'IPv4' && !net.internal) return net.address
    }
  }
  return null
}

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'print-lan-url',
      configureServer(server) {
        server.httpServer?.once('listening', () => {
          const ip = getLanIp()
          if (!ip) return
          const port = server.config.server.port || 5173
          console.log(`\n[LAN] Frontend: http://${ip}:${port}`)
          console.log(`[LAN] Backend API: http://${ip}:8000\n`)
        })
      },
    },
  ],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
