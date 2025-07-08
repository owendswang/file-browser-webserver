import axios from '@/utils/axios';

const RecycleServices = {
  async getList(params = {}, signal) {
    const res = await axios.request({
      url: '/recycle',
      params,
      signal,
    });
    return res.data;
  },

};

export default RecycleServices;