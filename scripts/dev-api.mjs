import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const temp = fileURLToPath(new URL('../.wrangler/tmp/', import.meta.url))
mkdirSync(temp, { recursive: true })
// Keep workerd's temporary stores in the writable project on Windows.
const child = spawn(process.execPath, [
  fileURLToPath(new URL('../node_modules/wrangler/bin/wrangler.js', import.meta.url)),
  'pages', 'dev', 'dist', '--ip', '127.0.0.1', '--port', '8789', ...process.argv.slice(2),
], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, WRANGLER_SEND_METRICS: 'false', ...(process.platform === 'win32' ? { TEMP: temp, TMP: temp } : {}) },
})
child.on('error', error => { console.error('无法启动本地 Pages 运行时：', error.message); process.exitCode = 1 })
child.on('exit', code => { process.exitCode = code ?? 1 })
process.on('SIGINT', () => child.kill('SIGINT'))
process.on('SIGTERM', () => child.kill('SIGTERM'))
