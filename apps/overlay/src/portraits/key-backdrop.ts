export type Raster = {
  width: number
  height: number
  data: Uint8ClampedArray
}

export function opaquePixelRatio(image: Raster): number {
  const pixels = image.width * image.height
  if (pixels === 0) {
    return 0
  }
  let opaque = 0
  for (let i = 3; i < image.data.length; i += 4) {
    if (image.data[i]! > 16) {
      opaque += 1
    }
  }
  return opaque / pixels
}

/** Knock out the studio backdrop without eating black gear in the silhouette. */
export function punchStudioBlack(image: Raster, limit = 14): void {
  const { width, height, data } = image
  const size = width * height
  const isBackdrop = (pixel: number): boolean => {
    const i = pixel * 4
    return data[i]! < limit && data[i + 1]! < limit && data[i + 2]! < limit
  }

  const seen = new Uint8Array(size)
  const stack: number[] = []

  const visit = (x: number, y: number): void => {
    if (x < 0 || y < 0 || x >= width || y >= height) {
      return
    }
    const pixel = y * width + x
    if (seen[pixel]) {
      return
    }
    seen[pixel] = 1
    if (!isBackdrop(pixel)) {
      return
    }
    stack.push(pixel)
  }

  for (let x = 0; x < width; x++) {
    visit(x, 0)
    visit(x, height - 1)
  }
  for (let y = 0; y < height; y++) {
    visit(0, y)
    visit(width - 1, y)
  }

  while (stack.length > 0) {
    const pixel = stack.pop()!
    const i = pixel * 4
    data[i + 3] = 0
    const x = pixel % width
    const y = (pixel / width) | 0
    visit(x - 1, y)
    visit(x + 1, y)
    visit(x, y - 1)
    visit(x, y + 1)
  }
}
