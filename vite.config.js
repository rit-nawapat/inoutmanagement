import { defineConfig } from 'vite';

export default defineConfig({
  base: '/inoutmanagement/',
  server: {
    // อนุญาตเฉพาะซับโดเมนของ lhr.life เท่านั้น ปลอดภัยกว่าการเปิด true
    allowedHosts: ['.lhr.life']
  }
});