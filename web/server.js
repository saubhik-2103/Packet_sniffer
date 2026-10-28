const { WebSocketServer } = require("ws");
const { spawn } = require("child_process");
const path = require("path");

const WS_PORT = 8080;
const SNIFFER_PATH = path.resolve(__dirname, "../sniffer");

const wss = new WebSocketServer({ port: WS_PORT });

console.log(`WebSocket server listening on ws://localhost:${WS_PORT}`);

// Spawn the sniffer — requires sudo for raw socket access
const sniffer = spawn("sudo", [SNIFFER_PATH], {
  stdio: ["ignore", "pipe", "pipe"],
});

console.log(`Sniffer spawned (PID: ${sniffer.pid})`);

let buffer = "";

sniffer.stdout.on("data", (chunk) => {
  buffer += chunk.toString();

  // Process complete JSON lines
  let lines = buffer.split("\n");
  buffer = lines.pop(); // keep incomplete last line in buffer

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Validate JSON before broadcasting
    try {
      JSON.parse(trimmed);
    } catch {
      console.warn("Non-JSON line from sniffer:", trimmed);
      continue;
    }

    // Broadcast to all connected clients
    for (const client of wss.clients) {
      if (client.readyState === client.OPEN) {
        client.send(trimmed);
      }
    }
  }
});

sniffer.stderr.on("data", (data) => {
  const msg = data.toString().trim();
  if (msg) console.error(`[sniffer stderr] ${msg}`);
});

sniffer.on("close", (code) => {
  console.log(`Sniffer exited with code ${code}`);
  process.exit(code ?? 1);
});

// Graceful shutdown
function cleanup() {
  console.log("\nShutting down...");
  sniffer.kill("SIGTERM");
  wss.close();
  process.exit(0);
}

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);
