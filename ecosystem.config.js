module.exports = {
  apps: [
    {
      name: "talatisutra",
      cwd: __dirname,
      script: "node_modules/next/dist/bin/next",
      args: "start",
      env: {
        NODE_ENV: "production",
      },
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "512M",
      error_file: "/home/talatisutra/logs/error.log",
      out_file: "/home/talatisutra/logs/out.log",
      time: true,
    },
  ],
};
