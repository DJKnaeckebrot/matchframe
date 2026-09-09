import { mkdir } from "node:fs/promises"
import { join } from "node:path"
import { deflateSync } from "node:zlib"

const WIDTH = 32
const HEIGHT = 32
const BG = [0x0c, 0x10, 0x14, 0xff] as const
const FG = [0xc4, 0xa5, 0x74, 0xff] as const

function crcTable(): Uint32Array {
  const table = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    table[i] = c
  }
  return table
}

const CRC = crcTable()

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff
  for (const byte of bytes) {
    c = CRC[(c ^ byte) & 0xff]! ^ (c >>> 8)
  }
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(8 + data.length + 4)
  const view = new DataView(out.buffer)
  view.setUint32(0, data.length)
  out[4] = type.charCodeAt(0)
  out[5] = type.charCodeAt(1)
  out[6] = type.charCodeAt(2)
  out[7] = type.charCodeAt(3)
  out.set(data, 8)
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)))
  return out
}

function paintM(pixels: Uint8Array): void {
  for (let i = 0; i < WIDTH * HEIGHT; i++) {
    pixels.set(BG, i * 4)
  }
  function set(x: number, y: number): void {
    if (x < 0 || y < 0 || x >= WIDTH || y >= HEIGHT) {
      return
    }
    pixels.set(FG, (y * WIDTH + x) * 4)
  }
  for (let y = 7; y <= 24; y++) {
    set(6, y)
    set(7, y)
    set(8, y)
    set(23, y)
    set(24, y)
    set(25, y)
  }
  for (let i = 0; i <= 8; i++) {
    const y = 8 + i
    set(8 + i, y)
    set(9 + i, y)
    set(10 + i, y)
    set(23 - i, y)
    set(22 - i, y)
    set(21 - i, y)
  }
}

function pngBytes(): Uint8Array {
  const pixels = new Uint8Array(WIDTH * HEIGHT * 4)
  paintM(pixels)
  const raw = new Uint8Array((WIDTH * 4 + 1) * HEIGHT)
  for (let y = 0; y < HEIGHT; y++) {
    const row = y * (WIDTH * 4 + 1)
    raw[row] = 0
    raw.set(pixels.subarray(y * WIDTH * 4, (y + 1) * WIDTH * 4), row + 1)
  }
  const ihdr = new Uint8Array(13)
  const view = new DataView(ihdr.buffer)
  view.setUint32(0, WIDTH)
  view.setUint32(4, HEIGHT)
  ihdr[8] = 8
  ihdr[9] = 6
  const signature = Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10)
  const parts = [signature, chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", new Uint8Array())]
  const total = parts.reduce((sum, part) => sum + part.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.length
  }
  return out
}

function icoFromPng(png: Uint8Array): Uint8Array {
  const out = new Uint8Array(6 + 16 + png.length)
  const view = new DataView(out.buffer)
  view.setUint16(0, 0, true)
  view.setUint16(2, 1, true)
  view.setUint16(4, 1, true)
  out[6] = WIDTH
  out[7] = HEIGHT
  out[8] = 0
  out[9] = 0
  view.setUint16(10, 1, true)
  view.setUint16(12, 32, true)
  view.setUint32(14, png.length, true)
  view.setUint32(18, 22, true)
  out.set(png, 22)
  return out
}

export async function writeMatchframeIcon(dir: string): Promise<string> {
  await mkdir(dir, { recursive: true })
  const path = join(dir, "matchframe.ico")
  await Bun.write(path, icoFromPng(pngBytes()))
  return path
}

if (import.meta.main) {
  const path = await writeMatchframeIcon(import.meta.dir)
  console.log(path)
}
