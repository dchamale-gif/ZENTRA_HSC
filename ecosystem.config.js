module.exports = {
  apps: [
    {
      name: 'zentra-app',
      script: './backend/server.js',
      cwd: '/opt/stack/ZENTRA_HSC',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3011
      },
      error_file: '/var/log/zentra/backend-error.log',
      out_file: '/var/log/zentra/backend-out.log',
      log_file: '/var/log/zentra/backend-combined.log',
      time: true,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M'
    },
    {
      name: 'webtrop',
      script: './frontend-server.js',
      cwd: '/opt/stack/ZENTRA_HSC',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        FRONTEND_PORT: 5501
      },
      error_file: '/var/log/zentra/frontend-error.log',
      out_file: '/var/log/zentra/frontend-out.log',
      log_file: '/var/log/zentra/frontend-combined.log',
      time: true,
      autorestart: true,
      watch: false,
      max_memory_restart: '250M'
    }
  ]
};
