import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { CallToolResult, Tool } from '@modelcontextprotocol/sdk/types.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MCP_SERVER_PATH = path.resolve(__dirname, '../../mcp-server/src/index.ts');

export class MCPClient {
  private readonly client: Client;
  private connected = false;

  constructor() {
    this.client = new Client(
      { name: 'orchestrator-client', version: '1.0.0' },
      { capabilities: {} }
    );
  }

  async connect(): Promise<void> {
    if (this.connected) return;
    const transport = new StdioClientTransport({
      command: 'npx',
      args: ['tsx', MCP_SERVER_PATH],
      env: { ...process.env, FORCE_COLOR: '0' } as Record<string, string>,
    });
    await this.client.connect(transport);
    this.connected = true;
  }

  async listTools(): Promise<Tool[]> {
    await this.connect();
    const result = await this.client.listTools();
    return result.tools;
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    await this.connect();
    const result = (await this.client.callTool({ name, arguments: args })) as CallToolResult;
    const textContent = result.content.find((c) => c.type === 'text');
    if (textContent?.type !== 'text') {
      throw new Error(`No text content in MCP response for tool: ${name}`);
    }
    return JSON.parse(textContent.text);
  }

  async disconnect(): Promise<void> {
    if (!this.connected) return;
    await this.client.close();
    this.connected = false;
  }
}
