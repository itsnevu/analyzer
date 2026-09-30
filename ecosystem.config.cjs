// pm2 process file: `pm2 start ecosystem.config.cjs`, then `pm2 save`. See DEPLOY.md.
module.exports = {
  apps: [
    {
      name: "hoax-analyzer",
      script: "node_modules/next/dist/bin/next",
      // Listen on this machine only; the HTTPS proxy (Cloudflare Tunnel or Caddy) is the public entrance.
      args: "start -p 3000 -H 127.0.0.1",
      cwd: __dirname,
      env: { NODE_ENV: "production" },
      max_memory_restart: "800M",
      time: true,
    },
  ],
};
