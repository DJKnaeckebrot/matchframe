import { describe, expect, test } from "bun:test"

import { punchStudioBlack } from "./key-backdrop"

function raster(width: number, height: number, fill: [number, number, number, number]): {
  width: number
  height: number
  data: Uint8ClampedArray
} {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let i = 0; i < data.length; i += 4) {
    data[i] = fill[0]
    data[i + 1] = fill[1]
    data[i + 2] = fill[2]
    data[i + 3] = fill[3]
  }
  return { width, height, data }
}

describe("punchStudioBlack", () => {
  test("clears a black frame and keeps an interior figure", () => {
    const image = raster(4, 4, [0, 0, 0, 255])
    const center = (1 * 4 + 1) * 4
    image.data[center] = 40
    image.data[center + 1] = 80
    image.data[center + 2] = 30
    image.data[center + 3] = 255

    punchStudioBlack(image)

    expect(image.data[3]).toBe(0)
    expect(image.data[center + 3]).toBe(255)
    expect(image.data[center + 1]).toBe(80)
  })

  test("keeps interior black that is ringed off from the studio edge", () => {
    const image = raster(5, 5, [0, 0, 0, 255])
    for (let y = 1; y <= 3; y++) {
      for (let x = 1; x <= 3; x++) {
        const i = (y * 5 + x) * 4
        image.data[i] = 80
        image.data[i + 1] = 80
        image.data[i + 2] = 80
      }
    }
    const hole = (2 * 5 + 2) * 4
    image.data[hole] = 0
    image.data[hole + 1] = 0
    image.data[hole + 2] = 0
    image.data[hole + 3] = 255

    punchStudioBlack(image)

    expect(image.data[3]).toBe(0)
    expect(image.data[hole + 3]).toBe(255)
  })
})
