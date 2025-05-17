import axios from '@/utils/axios';

const LoginServices = {
  async login(data) {
    const bodyParams = new URLSearchParams();
    bodyParams.append('username', data.username);
    bodyParams.append('password', data.password);
    const res = await axios.request({
      method: 'post',
      url: `/login`,
      data: bodyParams,
    });
    return res;
  },

  async register(data) {
    const res = await axios.request({
      method: 'post',
      url: `/register`,
      data,
    });
    return res;
  },

  async token(refreshToken) {
    const bodyParams = new URLSearchParams();
    bodyParams.append('refresh_token', refreshToken);
    const res = await axios.request({
      method: 'post',
      url: `/token`,
      data: bodyParams,
    });
    return res;
  }
};

export default LoginServices;