import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
    plugins: [
        react(),
        tailwindcss(),
    ],
    server: {
        proxy: {
            '/api': {
                target: 'https://dion-sikak-yayasanumum.0oh83a.easypanel.host',
                changeOrigin: true,
            }
        }
    }
})
