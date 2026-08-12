import { describe, expect, it } from "vitest";
import { getHealthStatus } from "../../src/tools/health.js";

describe("getHealthStatus", () => {
  it("reports ok status with server name, version, and timestamp", () => {
    const health = getHealthStatus();

    expect(health.status).toBe("ok");
    expect(health.server).toBe("trello-ops-mcp");
    expect(health.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(() => new Date(health.timestamp).toISOString()).not.toThrow();
  });
});
