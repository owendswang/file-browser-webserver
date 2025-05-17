import axios from '@/utils/axios';

const UserServices = {
  async login(data) {
    const bodyParams = new URLSearchParams();
    for (const [key, val] of Object.entries(data)) {
      bodyParams.append(key, val);
    }
    const res = await axios.request({
      method: 'post',
      url: `/login`,
      data: bodyParams,
    });
    return res.data;
  },

  async register(data) {
    const res = await axios.request({
      method: 'post',
      url: `/register`,
      data,
    });
    return res.data;
  },

  async logout(refreshToken) {
    const res = await axios.request({
      method: 'post',
      url: `/logout`,
      data: {
        refreshToken
      }
    });
    return res.data;
  },

  async getUserInfo(signal) {
    const res = await axios.request({
      url: `/user`,
      signal
    });
    return res.data;
  },

  async setUserInfo(data) {
    const res = await axios.request({
      method: 'post',
      url: `/user`,
      data,
    });
    return res.data;
  }
};

export default UserServices;