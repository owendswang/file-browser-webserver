import React, { useEffect, useState } from "react";
import InfiniteScroll from 'react-infinite-scroll-component';
import { List, Skeleton, Switch, Space } from 'antd';
import { CaretRightOutlined, XFilled } from '@ant-design/icons';
import { ProCard } from '@ant-design/pro-components';
import folderService from '@/services/folder';
import VideSideListItem from '@/pages/Play/VideoSideList/VideoSideListItem';
import "@/pages/Play/VideoSideList/index.css";

const VideoSideList = (props) => {
  const { pathname, messageApi, searchParams, handleErrorContent, playingFileName, playlist, setPlaylist, location, ...otherProps } = props;

  const [playlistLoading, setPlaylistLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(1);

  const fetchPlaylist = async (signal) => {
    setPlaylistLoading(true);
    const params = {
      page,
      pageSize: 20,
      sortBy: 'modified',
      order: 'desc',
      archivePassword: searchParams.get('archivePassword') || '',
      type: 'video'
    };
    try {
      const res = await folderService.getList(pathname, params, signal);
      if (res?.files && Array.isArray(res.files)) {
        setPlaylist((prev) => prev.concat(res.files));
        setTotal(res.pagination.total);
        if (!playlist.map((file) => file.name).includes(playingFileName)) {
          setPage((prev) => (prev + 1));
        }
      }
    } catch (e) {
      console.log(e);
      if (e.message !== 'canceled') {
        messageApi.error(`Failed to fetch playlist: ${handleErrorContent(e)}`);
      }
    } finally {
      if (playlist.map((file) => file.name).includes(playingFileName)) {
        setPlaylistLoading(false);
      }
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    fetchPlaylist(controller.signal);
    return () => {
      controller.abort();
    }
  }, [page]);

  useEffect(() => {
    if (!playlistLoading) {
      const playingThumbnail = document.querySelector('#videoSideListCard a.videoSideListItem.videoSideListItemActive');
      if (playingThumbnail) {
        playingThumbnail.scrollIntoView();
      }
    }
  }, [playlistLoading, location.pathname]);

  return (
    <ProCard
      id="videoSideListCard"
      bordered={true}
      ghost={true}
      title="Playlist"
      headerBordered={true}
      extra={<Space gap="small" wrap={false}>
        <>Auto next:</>
        <Switch
          checkedChildren={<CaretRightOutlined />}
          unCheckedChildren={<XFilled />}
          defaultChecked={window.localStorage.getItem('autoContinuePlay') === 'true'}
          onChange={(checked, e) => { window.localStorage.setItem('autoContinuePlay', checked.toString()); }}
        />
      </Space>}
      {...otherProps}
    >
      <div id="videoSideListInfiniteScrollCtn">
        <InfiniteScroll
          dataLength={playlist.length}
          next={() => setPage((prev) => (prev + 1))}
          hasMore={playlist.length < total}
          loader={playlistLoading && <Skeleton avatar={{ shape: 'square', size: 'large' }} title={true} paragraph={{ rows: 1 }} active={true} className="videoSideListItemLoadingMore" />}
          scrollableTarget="videoSideListInfiniteScrollCtn"
        >
          <List
            loading={playlistLoading}
            dataSource={playlist}
            renderItem={(item, index) => (
              <VideSideListItem
                item={item}
                searchParams={searchParams}
                playingFileName={playingFileName}
              />
            )}
            split={false}
          />
        </InfiniteScroll>
      </div>
    </ProCard>
  );
}

export default VideoSideList;