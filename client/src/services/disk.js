import axios from '@/utils/axios';

const DiskServices = {
  async get(diskId, signal) {
    const res = await axios.request({
      url: `/disk/${diskId}`,
      signal,
    });
    return res.data;
  },
};

export default DiskServices;