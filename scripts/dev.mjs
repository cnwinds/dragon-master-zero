import { spawn } from "node:child_process";

const procs = [];
const add = (name, cmd, args) => {
  const p = spawn(cmd, args, { stdio: "inherit", shell: true });
  p.on("exit", (code) => {
    for (const q of procs) q.kill();
    process.exit(code ?? 0);
  });
  procs.push(p);
};

add("server", "npx", ["tsx", "server/index.ts"]);
add("client", "npx", ["vite"]);
