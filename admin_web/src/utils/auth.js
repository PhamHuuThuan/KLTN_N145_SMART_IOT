const TOKEN_KEY = 'admin_auth_token';

export const getAuthToken = () => {
  return localStorage.getItem(TOKEN_KEY);
};

export const setAuthToken = (token) => {
  localStorage.setItem(TOKEN_KEY, token);
};

export const removeAuthToken = () => {
  localStorage.removeItem(TOKEN_KEY);
};
