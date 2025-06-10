import axios from 'axios';

const axiosInstance = axios.create({
  baseURL: '/api',
  // timeout: 30000,
});

axiosInstance.interceptors.request.use(
  function (config) {
    /*const accessToken = sessionStorage.getItem('accessToken') || localStorage.getItem('accessToken');
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }*/
    config.headers['Cache-Control'] = 'no-cache';
    config.headers.Pragma = 'no-cache';
    return config;
  }, function (error) {
    // Do something with request error
    return Promise.reject(error);
  }
);

axiosInstance.interceptors.response.use(
  function (response) {
    // Any status code that lie within the range of 2xx cause this function to trigger
    // Do something with response data
    return response;
  },
  async function (error) {
    console.error(error);
    // Any status codes that falls outside the range of 2xx cause this function to trigger
    // Do something with response error
    const originalRequest = error.config;
    // 检查错误是否由于 401 Unauthorized（Token 过期）
    //const refreshToken = sessionStorage.getItem('refreshToken') || localStorage.getItem('refreshToken');
    if (error.response.status === 401 && !originalRequest._retry /*&& refreshToken*/) {
      originalRequest._retry = true; // 防止无限循环
      try {
        // 使用 refreshToken 请求新的 accessToken
        /*const bodyParams = new URLSearchParams();
        bodyParams.append('refresh_token', refreshToken);
        const res = await axiosInstance.post('/token', bodyParams);
        const currentDate = new Date();
        const expiresAt = new Date(currentDate.getTime() + res.expires_in * 1000);
        if (values.autoLogin) {
          localStorage.setItem('autoLogin', true);
          localStorage.setItem('accessToken', res.access_token);
          localStorage.setItem('refreshToken', res.refresh_token);
          localStorage.setItem('expiresAt', expiresAt);
        } else {
          localStorage.setItem('autoLogin', false);
          sessionStorage.setItem('accessToken', res.access_token);
          sessionStorage.setItem('refreshToken', res.refresh_token);
          sessionStorage.setItem('expiresAt', expiresAt);
        }
        // 更新请求头并重新发送原始请求
        originalRequest.headers['Authorization'] = `Bearer ${res.access_token}`;*/
        await axiosInstance.post('/token', new URLSearchParams());
        return axiosInstance(originalRequest);
      } catch(e) {
        // 处理刷新 token 的错误，例如 token 已失效
        console.log('Refresh token failed:', e);
        return Promise.reject(e);
      }
    }
    // 如果不是 token 过期错误，则直接抛出
    return Promise.reject(error);
  }
);

export default axiosInstance;
