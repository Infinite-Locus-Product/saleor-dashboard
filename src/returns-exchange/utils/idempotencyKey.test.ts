import { generateIdempotencyKey } from "./idempotencyKey";

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("generateIdempotencyKey", () => {
  const originalCrypto = global.crypto;

  afterEach(() => {
    global.crypto = originalCrypto;
  });

  it("uses crypto.randomUUID when available", () => {
    // Arrange
    global.crypto = {
      ...originalCrypto,
      randomUUID: () => "11111111-2222-4333-8444-555555555555",
    } as Crypto;

    // Act
    const key = generateIdempotencyKey();

    // Assert
    expect(key).toBe("11111111-2222-4333-8444-555555555555");
  });

  it("falls back to getRandomValues and still produces a v4 UUID", () => {
    // Arrange
    global.crypto = {
      getRandomValues: originalCrypto.getRandomValues,
    } as Crypto;

    // Act
    const first = generateIdempotencyKey();
    const second = generateIdempotencyKey();

    // Assert
    expect(first).toMatch(UUID_V4);
    expect(second).toMatch(UUID_V4);
    expect(first).not.toBe(second);
  });

  it("falls back to a time/random key when crypto is unavailable", () => {
    // Arrange
    global.crypto = undefined as unknown as Crypto;

    // Act
    const key = generateIdempotencyKey();

    // Assert
    expect(key.length).toBeGreaterThan(10);
    expect(key.length).toBeLessThanOrEqual(64);
    expect(generateIdempotencyKey()).not.toBe(key);
  });
});
