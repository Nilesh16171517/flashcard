import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
export default defineConfig({plugins:[react(),VitePWA({registerType:'autoUpdate',includeAssets:['favicon.svg'],manifest:{name:'RecallForge',short_name:'RecallForge',description:'Local-first flashcards with image occlusion',theme_color:'#111827',background_color:'#f8fafc',display:'standalone',start_url:'./',icons:[{src:'favicon.svg',sizes:'any',type:'image/svg+xml',purpose:'any maskable'}]},workbox:{navigateFallback:'index.html'}})],base:'./'});