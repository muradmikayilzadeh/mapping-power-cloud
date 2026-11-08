module.exports = {
  apps: [
    {
      name: 'sfurbanhistory-api',
      script: 'src/index.js',
      cwd: __dirname,
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
