import axios from '@/utils/axios';

const ConfigServices = {
  async get() {
    const res = await axios.request({
      url: '/config',
    });
    return res.data;
  },

  async set(values) {
    const res = await axios.request({
      method: 'post',
      url: '/config',
      data: values,
    });
    return res.data;
  },

};

export default ConfigServices;