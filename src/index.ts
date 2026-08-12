#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadEnv } from "./config/env.js";
import { SERVER_NAME, SERVER_VERSION } from "./config/version.js";
import { createLogger } from "./utils/logger.js";
import { registerAllTools } from "./tools/index.js";

async function main(): Promise<void> {
  const env = loadEnv();
  const logger = createLogger(env.LOG_LEVEL);

  const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
  });

  registerAllTools(server);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  logger.info("trello-ops-mcp server started", { version: SERVER_VERSION });
}

main().catch((error) => {
  process.stderr.write(`Fatal error starting trello-ops-mcp: ${String(error)}\n`);
  process.exit(1);
});
