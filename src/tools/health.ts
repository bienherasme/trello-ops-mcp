import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SERVER_NAME, SERVER_VERSION } from "../config/version.js";

export interface HealthStatus {
  status: "ok";
  server: string;
  version: string;
  timestamp: string;
}

/**
 * Pure status computation, kept separate from tool registration so it can
 * be unit tested without spinning up an MCP server or transport.
 */
export function getHealthStatus(): HealthStatus {
  return {
    status: "ok",
    server: SERVER_NAME,
    version: SERVER_VERSION,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Diagnostic tool for verifying the server is running and reachable.
 * Requires no Trello credentials, so it also doubles as a connectivity
 * check independent of any Trello account configuration.
 */
export function registerHealthCheckTool(server: McpServer): void {
  server.registerTool(
    "health_check",
    {
      title: "Health Check",
      description:
        "Checks that the trello-ops-mcp server is running and reachable. Requires no Trello " +
        "credentials — useful for verifying the MCP connection itself before troubleshooting anything else.",
    },
    async () => {
      const health = getHealthStatus();
      return {
        content: [{ type: "text", text: JSON.stringify(health, null, 2) }],
      };
    },
  );
}
