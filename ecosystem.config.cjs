module.exports = {
  apps: [
    {
      name: 'fundcalc',
      cwd: '/var/www/fundcalc',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 6005',
      env: {
        NODE_ENV: 'production',
      },
      instances: 1,
      autorestart: true,
      max_memory_restart: '300M',
    },
  ],
};
