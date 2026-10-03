const path = require("path");

const rootDir = __dirname;

module.exports = {
  apps: [
    {
      name: "smcf-sacco-backend",
      cwd: path.join(rootDir, "smcf-sacco-backend"),
      script: "dist/server.js",
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      watch: false,
      max_restarts: 10,
      min_uptime: "10s",
      env: {
        NODE_ENV: "production",
        PORT: 5001,
      },
    },
  ],
};