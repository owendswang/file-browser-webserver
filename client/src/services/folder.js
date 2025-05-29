import axios from '@/utils/axios';

const FolderServices = {
  async getList(pathname, params = {}, signal) {
    const res = await axios.request({
      url: `/folder/${pathname}`,
      params,
      signal,
    });
    return res.data;
  },

  async getFolderTree(pathname, params = {}, signal) {
    const res = await axios.request({
      url: `/foldertree/${pathname}`,
      params,
      signal,
    });
    return res.data;
  },

  async delete(pathname, params = {}) {
    const res = await axios.request({
      method: 'delete',
      url: `/delete/${pathname}`,
      params,
    });
    return res.data;
  },

  async brief(pathname, params = {}, signal) {
    const res = await axios.request({
      url: `/brief/${pathname}`,
      params,
      signal
    });
    return res.data;
  },

  async move(src, dst, params = {}) {
    const res = await axios.request({
      url: `/move/${src}`,
      params: {
        ...params,
        dst,
      },
    });
    return res.data;
  },

  async copy(src, dst, params = {}) {
    const res = await axios.request({
      url: `/move/${src}`,
      params: {
        ...params,
        dst,
        keepSrc: 1,
      },
    });
    return res.data;
  },

  async decompress(src, dst, params = {}) {
    const res = await axios.request({
      url: `/decompress/${src}`,
      params: {
        ...params,
        dst,
      },
    });
    return res.data;
  },

  async rename(pathname, newName, params = {}) {
    const res = await axios.request({
      url: `/rename/${pathname}`,
      params: {
        ...params,
        newName,
      },
    });
    return res.data;
  },

  async upload(pathname, params = {}, file) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('lastModified', file.lastModified);
    const res = await axios.request({
      method: 'post',
      url: `/upload/${pathname}`,
      params,
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },

  async mkdir(pathname, dir, params = {}) {
    const res = await axios.request({
      url: `/mkdir/${pathname}`,
      params: {
        ...params,
        dir,
      }
    });
    return res.data;
  }

};

export default FolderServices;