// Dynamic Expo config: loads .env and sets extra.apiUrl
import 'dotenv/config';

export default ({ config }) => {
  const host = process.env.API_URL
    ? null
    : (process.env.GATEWAY_HOST || '127.0.0.1');
  const port = process.env.API_URL
    ? null
    : (process.env.GATEWAY_PORT || '3000');

  const apiUrl = process.env.API_URL || `http://${host}:${port}`;

  return {
    ...config,
    extra: {
      ...(config.extra || {}),
      apiUrl
    }
  };
};
