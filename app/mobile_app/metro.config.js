const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add support for environment variables
config.resolver.platforms = ['ios', 'android', 'native', 'web'];

// Configure for web development
if (process.env.EXPO_WEB) {
  config.resolver.alias = {
    ...config.resolver.alias,
    // Add any web-specific aliases here
  };
}

module.exports = config;
