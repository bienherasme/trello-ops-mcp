import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerActionsTools } from "./actions.js";
import { registerDiscoveryTools } from "./discovery.js";
import { registerDueDateTools } from "./dueDates.js";
import { registerHealthCheckTool } from "./health.js";
import { registerListFlowTool } from "./listFlow.js";
import { registerMemberActivityTool } from "./memberActivity.js";
import { registerMovementTools } from "./movements.js";
import { registerStaleCardsTool } from "./staleCards.js";

export function registerAllTools(server: McpServer): void {
  registerHealthCheckTool(server);
  registerDiscoveryTools(server);
  registerActionsTools(server);
  registerMovementTools(server);
  registerMemberActivityTool(server);
  registerDueDateTools(server);
  registerListFlowTool(server);
  registerStaleCardsTool(server);
}
