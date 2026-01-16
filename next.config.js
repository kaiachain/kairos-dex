const { configureWebpack } = require('./webpack.config');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { isServer }) => {
    // Use extracted webpack configuration
    return configureWebpack(config, { isServer });
  },
};

module.exports = nextConfig;
