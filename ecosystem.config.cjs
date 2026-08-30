module.exports = {
  apps: [
    {
      name: "scenova-web",
      cwd: "/home/scenova/app",
      script: "node_modules/next/dist/bin/next",
      args: "start -H 127.0.0.1 -p 3000",
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      max_memory_restart: "1500M",
      env: {
        NODE_ENV: "production",
      },
      time: true,
    },
    {
      name: "scenova-agent-worker",
      cwd: "/home/scenova/app",
      script: "node_modules/tsx/dist/cli.mjs",
      args: "scripts/agent-worker.ts",
      interpreter: "node",
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      restart_delay: 2000,
      max_memory_restart: "1000M",
      env: {
        NODE_ENV: "production",
        AGENT_WORKER_CONCURRENCY: "2",
      },
      time: true,
    },
  ],
};
