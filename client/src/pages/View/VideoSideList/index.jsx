import React, { useEffect, useState } from "react";
import InfiniteScroll from 'react-infinite-scroll-component';
import { List, Skeleton } from 'antd';
import { ProCard } from '@ant-design/pro-components';
import folderService from '@/services/folder';
import "@/pages/View/VideoSideList/index.css";

const VideoSideList = (props) => {
  const { pathname, messageApi, searchParams, handleErrorContent } = props;

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(1);

  const fetchData = async (signal) => {
    if (!loading) {
      setLoading(true);
      const params = {
        page,
        pageSize: 20,
        sortBy: 'name',
        order: 'asc',
        archivePassword: searchParams.get('archivePassword') || '',
        type: 'video'
      };
      try {
        const res = await folderService.getList(pathname, params, signal);
        if (res?.files && Array.isArray(res.files)) {
          setData((prev) => prev.concat(res.files));
          setTotal(res.pagination.total);
        }
      } catch (e) {
        console.log(e);
        if (e.message !== 'canceled') {
          messageApi.error(`Failed to fetch data: ${handleErrorContent(e)}`);
        }
      } finally {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    fetchData(controller.signal);
    return () => {
      controller.abort();
    }
  }, [page]);

  return (
    <ProCard
      id="videoSideList"
      bordered={true}
      ghost={true}
    >
      <InfiniteScroll
        dataLength={data.length}
        next={() => setPage((prev) => (prev + 1))}
        hasMore={data.length < total}
        loader={loading && <Skeleton avatar={{ shape: 'square', size: 'large' }} title={true} paragraph={{ rows: 1 }} active={true} />}
        scrollableTarget="videoSideList"
      >
        <List
          dataSource={data}
          renderItem={(item, index) => (
            <List.Item key={item.name}>{item.name}</List.Item>
          )}
          split={false}
        />
      </InfiniteScroll>
    </ProCard>
  );
}

export default VideoSideList;