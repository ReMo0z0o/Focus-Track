/**
 * Minimal production server: serves the client build statically and hands
 * everything else to the TanStack Start fetch handler (dist/server/server.js).
 *
 *   npm run build && npm run start
 */
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import handler from './dist/server/server.js'

const PORT = Number(process.env.PORT ?? 3000)
const CLIENT_DIR = new URL('./dist/client', import.meta.url).pathname

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json',
}

async function tryStatic(pathname) {
  const safePath = normalize(pathname).replace(/^(\.\.[/\\])+/, '')
  const filePath = join(CLIENT_DIR, safePath)
  if (!filePath.startsWith(CLIENT_DIR)) return null
  try {
    const info = await stat(filePath)
    if (!info.isFile()) return null
    return {
      body: await readFile(filePath),
      type: MIME[extname(filePath)] ?? 'application/octet-stream',
      immutable: pathname.startsWith('/assets/'),
    }
  } catch {
    return null
  }
}

createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`)

    if (req.method === 'GET' || req.method === 'HEAD') {
      const file = await tryStatic(url.pathname)
      if (file) {
        res.writeHead(200, {
          'content-type': file.type,
          ...(file.immutable
            ? { 'cache-control': 'public, max-age=31536000, immutable' }
            : {}),
        })
        res.end(file.body)
        return
      }
    }

    const chunks = []
    for await (const chunk of req) chunks.push(chunk)
    const body = Buffer.concat(chunks)

    const response = await handler.fetch(
      new Request(url, {
        method: req.method,
        headers: req.headers,
        body: body.length > 0 ? body : undefined,
        duplex: 'half',
      }),
    )

    res.writeHead(
      response.status,
      Object.fromEntries(response.headers.entries()),
    )
    if (response.body) {
      for await (const chunk of response.body) res.write(chunk)
    }
    res.end()
  } catch (err) {
    console.error(err)
    res.writeHead(500)
    res.end('Internal server error')
  }
}).listen(PORT, () => {
  console.log(`FocusGuard running at http://localhost:${PORT}`)
})
