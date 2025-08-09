import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useLocation, useSearchParams, useNavigate, Link } from "react-router";
import { Helmet } from "react-helmet";
import { useTranslation } from 'react-i18next';
import { PageContainer } from '@ant-design/pro-components';
import { message, Empty, Typography, Space, Button, Spin, Popover, Flex, Modal } from 'antd';
import { FolderOpenOutlined, ReloadOutlined, QuestionCircleOutlined, PlayCircleFilled, CloseOutlined } from '@ant-design/icons';
import VideoJS from '@/components/VideoJS';
import VideoSideList from '@/pages/Play/VideoSideList';
import handleErrorContent from '@/utils/handleErrorContent';
import viewService from '@/services/view';
import "@/pages/Play/index.css";

const { Text, Paragraph } = Typography;

const Play = () => {
  const location = useLocation();

  const navigate = useNavigate();

  const [searchParams] = useSearchParams();

  const { t } = useTranslation('Play');

  const { '*': originalPathname } = useParams();
  const pathname = encodeURIComponent(originalPathname).replaceAll('%2F', '/');
  const pathParts = pathname.split('/').filter(Boolean);
  const fileName = decodeURIComponent(pathParts[pathParts.length - 1]);

  const breadcrumbItems = pathParts.slice(0, pathParts.length - 1).map((part, idx) => {
    if ((idx === pathParts.length - 1)) {
      return { title: decodeURIComponent(part) };
    } else {
      return { title: <Link
        to={`/folder/${pathParts.slice(0, idx + 1).join('/')}`}
      >{decodeURIComponent(part)}</Link> };
    }
  });

  const [messageApi, messageContextHolder] = message.useMessage();
  const [modalApi, modalContextHolder] = Modal.useModal();

  const playerRef = useRef(null);
  const playNextTimerRef = useRef(null);
  const playNextCountDownRef = useRef(null);

  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);
  const [playlist, setPlaylist] = useState([]);
  const [ws, setWs] = useState(null);

  const videoJsOptions = useMemo(() => ({
    autoplay: true,
    // muted: false,
    controls: true,
    responsive: true,
    liveui: true,
    fluid: true,
    controlBar: {
      volumePanel: {
        inline: false
      }
    },
    sources: [{
      src: `/download/${pathname}${searchParams.get('archivePassword') ? ('?archivePassword=' + searchParams.get('archivePassword')) : ''}`,
      type: data.mediaType,
    }/*, {
      src: `/play/${pathname}/index.m3u8${searchParams.get('archivePassword') ? ('?archivePassword=' + searchParams.get('archivePassword')) : ''}`,
      type: 'application/x-mpegURL',
    }*/]
  }), [pathname, searchParams.get('archivePassword'), data.mediaType]);

  const handlePlayerReady = (player) => {
    playerRef.current = player;

    const error = player.error();
    if (error.code === 4) {
      if (!ws) {
        const wsUrl = `ws://${window.location.host}/play`;
        const socket = new WebSocket(wsUrl);
        socket.onopen = () => {
          console.log('WS open');
          socket.send(JSON.stringify({ urlPath: pathname, archivePassword: searchParams.get('archivePassword') }, null, 4));
        };
        socket.onmessage = (event) => {
          console.log(event.data);
          const data = JSON.parse(event.data);
          if (data.srcUrl) {
            player.src({
              src: data.srcUrl,
              type: 'application/x-mpegURL',
            })
            player.play();
          }
          if (data.duration) {
            player.duration(data.duration);
          }
          if (data.currentTime) {
            player.currentTime(data.currentTime);
          }
          if (data.debug) {
            console.debug(data.debug);
          }
        };
        socket.onclose = (e) => {
          console.log(`WS close: [${e.code}] ${e.reason}`);
        };
        socket.onerror = (e) => {
          console.error(e);
        }
        setWs(socket);
      }
    }

    player.on('waiting', () => {
      // console.log('player is waiting');
    });

    player.on('dispose', () => {
      // console.log('player will dispose');
    });

    player.on('ended', () => {
      if (window.localStorage.getItem('autoContinuePlay') === 'true') {
        const currentPlayingIndex = playlist.map(item => item.name).indexOf(fileName);
        if ((currentPlayingIndex >= 0) && (currentPlayingIndex + 1 < playlist.length)) {
          const nextPlayingItem = playlist[currentPlayingIndex + 1];
          const nextPlayingName = nextPlayingItem.name.length > 20 ? `${nextPlayingItem.name.slice(0, 10)}...` : nextPlayingItem.name;
          
          const handlePlayNextCancel = (e) => {
            if (playNextCountDownRef.current) {
              clearInterval(playNextCountDownRef.current);
              playNextCountDownRef.current = null;
              messageApi.open({
                ...messageConfig,
                type: 'warning',
                content: t('Playing next canceled'),
                duration: 2
              });
            }
            if (playNextTimerRef.current) {
              clearTimeout(playNextTimerRef.current);
              playNextTimerRef.current = null;
            }
          }

          let countDownSeconds = 3;
          const messageConfig = {
            key: fileName,
            type: 'info',
            icon: <PlayCircleFilled />,
            content: <>{t('Playing next in {countDownSeconds} seconds: ', { countDownSeconds })}"{nextPlayingName}"<Button type="link" size="small" icon={<CloseOutlined />} onClick={handlePlayNextCancel} /></>,
            duration: 0
          };
          messageApi.open(messageConfig);
          playNextCountDownRef.current = setInterval(() => {
            countDownSeconds -= 1;
            messageApi.open({
              ...messageConfig,
              type: (countDownSeconds === 0) ? 'success' : 'info',
              content: <>{t('Playing next in {countDownSeconds} seconds: ', { countDownSeconds })}"{nextPlayingName}"<Button type="link" size="small" icon={<CloseOutlined />} onClick={handlePlayNextCancel} /></>,
              duration: (countDownSeconds === 0) ? 1 : 0
            });
            if (countDownSeconds === 0) {
              clearInterval(playNextCountDownRef.current);
              playNextCountDownRef.current = null;
            }
          }, 1000);
          
          playNextTimerRef.current = setTimeout(() => {
            playNextTimerRef.current = null;
            navigate({
              pathname: nextPlayingItem.path,
              search: searchParams.get('archivePassword') ? ('?archivePassword=' + searchParams.get('archivePassword')) : '',
            }, { replace: true });
          }, 3000);
        } else {
          messageApi.info(t('End of playlist'));
        }
      }
    });
  };

  const fetchData = async (signal) => {
    setLoading(true);
    try {
      const params = {
        archivePassword: searchParams.get('archivePassword'),
        type: 'play'
      };
      const res = await viewService.get(pathname, params, signal);
      // console.log(res);
      if (res) {
        setData(res);
        if (!['Video File', 'Audio File'].includes(res.fileType)) {
          throw new Error(t('Not playable file'));
        }
      }
    } catch(e) {
      console.error(e);
      if (e.message !== 'canceled') {
        messageApi.error(`${t('Failed to fetch data: ')}${handleErrorContent(e)}`);
      }
    }
    setLoading(false);
  }

  const handleRefreshButtonClick = (e) => {
    fetchData();
  }

  useEffect(() => {
    return () => {
      if (ws) {
        ws.close();
        setWs(null);
      }
    }
  }, [location.pathname, ws]);

  useEffect(() => {
    const abortController = new AbortController();
    fetchData(abortController.signal);

    return () => {
      abortController.abort();
      if (playNextCountDownRef.current) {
        clearInterval(playNextCountDownRef.current);
        playNextCountDownRef.current = null;
        messageApi.open({
          key: fileName,
          type: 'warning',
          icon: <PlayCircleFilled />,
          content: t('Playing next canceled'),
          duration: 2
        });
      }
      if (playNextTimerRef.current) {
        clearTimeout(playNextTimerRef.current);
        playNextTimerRef.current = null;
      }
    }
  }, [location.pathname]);

  return (
    <PageContainer
      title={fileName}
      breadcrumb={{
        items: breadcrumbItems,
      }}
      onBack={() => navigate(-1)}
      extra={<Space>
        {!loading && ['Video File', 'Audio File'].includes(data.fileType) && <Popover
          placement="bottomRight"
          title={t("Keyboard Controls")}
          content={<div style={{ lineHeight: '1.5rem' }}>{t('(when the player is focused)')}
            <ul style={{ margin: '0', paddingLeft: '1rem' }}>
              <li>{t('[Space]: Play/Pause')}</li>
              <li>{t('[←]/[→]: Rewind/Fast Forward (5 sec)')}</li>
              <li>{t('[↑]/[↓]: Volume Up/Down (5%)')}</li>
              <li>{t('[F]: Toggle Fullscreen')}</li>
              <li>{t('[M]: Mute/Unmute')}</li>
            </ul>
          </div>}
        >
          <Button
            key="playerHelp"
            type="link"
            icon={<QuestionCircleOutlined />}
            size="small"
          ></Button>
        </Popover>}
        <Button
          key="refresh"
          type="link"
          icon={<ReloadOutlined />}
          loading={loading}
          onClick={handleRefreshButtonClick}
          size="small"
          title={t('Refresh')}
        ></Button>
      </Space>}
    >
      <Helmet>
        <title>{fileName} - {t('File Browser')}</title>
      </Helmet>
      {messageContextHolder}
      {modalContextHolder}
      <Spin spinning={loading}>
        {(loading && Object.keys(data).length === 0) && 
        <div className="empty-container">
          <Empty
            style={{ maxWidth: '400px' }}
            image={<FolderOpenOutlined style={{ fontSize: '100px', color: 'rgba(0,0,0,0.25)' }} />} // Empty.PRESENTED_IMAGE_SIMPLE
            description={<Paragraph style={{ marginBottom: '16px' }}>
              <Text type="secondary">{t('No Data')}</Text>
            </Paragraph>}
          />
        </div>}
        <div className="videoPlayCtn" style={{ display: Object.keys(data).length === 0 ? 'none' : 'flex' }}>
          {Object.keys(data).length > 0 && <VideoJS
            key={pathname}
            options={videoJsOptions}
            onReady={handlePlayerReady}
          />}
          <VideoSideList
            key={pathParts.slice(0, pathParts.length - 1).join('/')}
            pathname={pathParts.slice(0, pathParts.length - 1).join('/')}
            messageApi={messageApi}
            searchParams={searchParams}
            handleErrorContent={handleErrorContent}
            playingFileName={fileName}
            playlist={playlist}
            setPlaylist={setPlaylist}
            location={location}
            t={t}
            modalApi={modalApi}
          />
        </div>
      </Spin>
    </PageContainer>
  );
};

export default Play;