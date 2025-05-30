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

  async delete(pathname, fileList, params = {}) {
    const res = await axios.request({
      method: 'post',
      url: `/delete/${pathname}`,
      params,
      data: fileList,
    });
    return res.data;
  },

  async move(pathname, fileList, dst, params = {}) {
    const res = await axios.request({
      method: 'post',
      url: `/move/${pathname}`,
      params: {
        ...params,
        dst,
      },
      data: fileList,
    });
    return res.data;
  },

  async copy(pathname, fileList, dst, params = {}) {
    const res = await axios.request({
      method: 'post',
      url: `/move/${pathname}`,
      params: {
        ...params,
        dst,
        keepSrc: 1,
      },
      data: fileList,
    });
    return res.data;
  },

  async decompress(pathname, fileList, dst, params = {}) {
    const res = await axios.request({
      method: 'post',
      url: `/decompress/${pathname}`,
      params: {
        ...params,
        dst,
      },
      data: fileList,
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