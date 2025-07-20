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

  async delete(fileList, params = {}) {
    const res = await axios.request({
      method: 'post',
      url: `/delete`,
      params,
      data: fileList,
    });
    return res.data;
  },

  async move(fileList, dst, params = {}) {
    const res = await axios.request({
      method: 'post',
      url: `/move`,
      params: {
        ...params,
        dst,
      },
      data: fileList,
    });
    return res.data;
  },

  async restore(fileList, params = {}) {
    const res = await axios.request({
      method: 'post',
      url: `/restore`,
      params: {
        ...params,
      },
      data: fileList,
    });
    return res.data;
  },

};

export default RecycleServices;