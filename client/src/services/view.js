import axios from '@/utils/axios';
import nativeAxios from 'axios';

const ViewServices = {
  async get(pathname, params = {}, signal) {
    const res = await axios.request({
      url: `/view/${pathname}`,
      params,
      signal,
    });
    return res.data;
  },

  async download(pathname, params = {}, signal) {
    const res = await nativeAxios.request({
      url: `/download/${pathname}`,
      params,
      signal,
      responseType: 'text',
    });
    return res.data;
  }
};

export default ViewServices;