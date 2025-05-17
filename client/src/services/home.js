import axios from '@/utils/axios';

const HomeServices = {
  async getFolders(signal) {
    const res = await axios.request({
      url: '/home',
      signal,
    });
    return res.data;
  },

  async sleep() {
    const res = await axios.request({
      url: '/sleep',
    });
    return res.data;
  }
};

export default HomeServices;