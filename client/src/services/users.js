import axios from '@/utils/axios';

const UsersServices = {
  async getList(params = {}, signal) {
    const res = await axios.request({
      url: `/users`,
      params,
      signal,
    });
    return res.data;
  },

  async delete(id) {
    const res = await axios.request({
      method: 'delete',
      url: `/users/${id}`,
      params: {},
    });
    return res.data;
  },

  async update(values) {
    const { id, ...data } = values;
    const res = await axios.request({
      method: 'post',
      url: `/users/${id}`,
      params: {},
      data,
    })
    return res.data;
  }
};

export default UsersServices;