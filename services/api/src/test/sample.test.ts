import { describe, expect, it } from "vitest"

describe("Vitest Setup", () => {
  it("should run basic tests", () => {
    expect(1 + 1).toBe(2)
  })

  it("should handle async operations", async () => {
    const result = await Promise.resolve("hello world")
    expect(result).toBe("hello world")
  })

  it("should work with objects", () => {
    const obj = { name: "test", value: 42 }
    expect(obj).toEqual({ name: "test", value: 42 })
  })
})