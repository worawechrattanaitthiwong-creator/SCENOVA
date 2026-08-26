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
  ],
};
