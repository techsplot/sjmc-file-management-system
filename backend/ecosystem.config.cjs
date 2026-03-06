module.exports = {
  apps: [
    {
      name: 'sjmc-backend',
      script: 'dist/server.js',
      cwd: '/var/www/file-record-sjmc/backend',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      restart_delay: 5000,
      min_uptime: '10s',
      max_restarts: 10,
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      error_file: '/var/log/sjmc-backend-error.log',
      out_file: '/var/log/sjmc-backend-out.log',
      time: true
    }
  ]
};
