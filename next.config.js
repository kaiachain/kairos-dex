/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { isServer }) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    };

    // Ignore optional dependencies that cause issues in browser
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        '@react-native-async-storage/async-storage': false,
        'pino-pretty': false,
      };
    }

    // Ignore modules that use Node.js APIs in browser
    config.externals = config.externals || [];
    if (isServer) {
      config.externals.push({
        'pino-pretty': 'commonjs pino-pretty',
      });
    }

    return config;
  },
};

module.exports = nextConfig;

