import React, { useEffect, useState, useRef } from "react";
import InfiniteScroll from 'react-infinite-scroll-component';
import { List, Skeleton, Switch, Space } from 'antd';
import { CaretRightOutlined, XFilled, PlayCircleOutlined } from '@ant-design/icons';
import { ProCard } from '@ant-design/pro-components';
import folderService from '@/services/folder';
import VideSideListItem from '@/pages/Play/VideoSideList/VideoSideListItem';
import "@/pages/Play/VideoSideList/index.css";

const VideoSideList = (props) => {
  const defaultPageSize = 20;

  const {
    pathname,
    messageApi,
    searchParams,
    handleErrorContent,
    playingFileName,
    playlist,
    setPlaylist,
    location,
    t,
    modalApi,
    ...otherProps
  } = props;

  const abortControllerRef = useRef(new AbortController());

  const [playlistLoading, setPlaylistLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(1);
  const [hasLocationChanged, setHasLocationChanged] = useState(false);

  const fetchPlaylist = async (signal) => {
    setPlaylistLoading(true);
    const params = {
      page,
      pageSize: defaultPageSize,
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
    } catch(e) {
      console.error(e);
      if (e.message !== 'canceled') {
        messageApi.error(`${t('Failed to fetch playlist: ')}${handleErrorContent(e)}`);
      }
    } finally {
      if (playlist.map((file) => file.name).includes(playingFileName)) {
        setPlaylistLoading(false);
      }
    }
  };

  const fetchPlaylistAfterDelete = async (name) => {
    setPlaylistLoading(true);
    const deleteIndex = playlist.findIndex((item) => item.name === name);
    const newPage = Math.ceil((deleteIndex + 1) / defaultPageSize);
    setPlaylist((prev) => {
      return prev.slice(0, (newPage - 1) * defaultPageSize);
    });
    setPage(newPage);
  }

  const handleDeleteClick = (name) => {
    modalApi.confirm({
      title: t('Delete'),
      content: t('Are you sure to delete it?'),
      closable: true,
      maskClosable: true,
      onOk: async () => {
        try {
          if (!name) {
            throw new Error(t('Nothing to delete'));
          }
          await folderService.delete(pathname, [name], searchParams.get('archivePassword') ? { archivePassword: searchParams.get('archivePassword') } : {});
        } catch(e) {
          console.error(e);
          messageApi.error(`${t('Delete failed: ')}${handleErrorContent(e)}`);
        } finally {
          fetchPlaylistAfterDelete(name);
        }
      },
    });
  }

  const handleJumpToPlaying = (e) => {
    e.preventDefault();
    const playingThumbnail = document.querySelector('#videoSideListCard a.videoSideListItem.videoSideListItemActive');
    if (playingThumbnail) {
      playingThumbnail.scrollIntoView();
    }
  }

  useEffect(() => {
    const newController = new AbortController();
    abortControllerRef.current = newController;
    fetchPlaylist(newController.signal);
    return () => {
      newController.abort();
    }
  }, [page]);

  useEffect(() => {
    setHasLocationChanged(true);
  }, [location.pathname]);

  useEffect(() => {
    if (hasLocationChanged && !playlistLoading) {
      const playingThumbnail = document.querySelector('#videoSideListCard a.videoSideListItem.videoSideListItemActive');
      if (playingThumbnail) {
        playingThumbnail.scrollIntoView();
        setHasLocationChanged(false);
      }
    }
  }, [playlistLoading, location.pathname]);

  return (
    <ProCard
      id="videoSideListCard"
      bordered={true}
      ghost={true}
      title={<>{t("Playlist")}<a style={{ marginLeft: '0.5rem' }} onClick={handleJumpToPlaying}><PlayCircleOutlined /></a></>}
      headerBordered={true}
      extra={<Space gap="small" wrap={false}>
        <>{t('Auto next:')}</>
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
          hasMore={!playlistLoading && (playlist.length < total)}
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
                t={t}
                modalApi={modalApi}
                handleDeleteClick={handleDeleteClick}
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