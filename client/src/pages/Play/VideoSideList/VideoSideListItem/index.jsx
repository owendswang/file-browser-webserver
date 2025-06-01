import React, { useState } from "react";
import { Link } from "react-router";
import { List, Button } from 'antd';
import { PlayCircleFilled, Loading3QuartersOutlined } from '@ant-design/icons';
import * as dayjs from 'dayjs';

const VideSideListItem = (props) => {
  const {
    item,
    searchParams,
    playingFileName,
    t,
    modalApi,
    handleDeleteClick,
    ...otherProps
  } = props;

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const handleImgLoad = (e) => {
    setLoading(false);
  };

  const handleImgError = (e) => {
    e.target.remove();
    setLoading(false);
    setLoadError(true);
  };

  return (
    <List.Item key={item.name} {...otherProps}>
      <Link
        key={item.name}
        title={`${item.name}${item.encrypted ? ' *' : ''}`}
        to={{
          pathname: item.path,
          search: searchParams.get('archivePassword') ? ('?archivePassword=' + searchParams.get('archivePassword')) : '',
        }}
        replace={true}
        className={`videoSideListItem${(playingFileName === item.name) ? ' videoSideListItemActive' : ''}`}
        onClick={(e) => { if (playingFileName === item.name) e.preventDefault(); }}
      >
        <div className="videoSideListItemThumbnailCtn">
          <img
            className="videoSideListItemThumbnailLayer videoSideListItemThumbnail"
            style={loadError ? {
              objectFit: 'contain',
              width: '50%',
              height: '50%',
              opacity: '0.5',
            } : {}}
            src={`${item.path.replace(/^\/vaplay\//g, '/preview/')}.webp${searchParams.get('archivePassword') ? ('?archivePassword=' + searchParams.get('archivePassword'))   : ''}`}
            onLoad={handleImgLoad}
            onError={handleImgError}
          />
          <div
            className="videoSideListItemThumbnailLayer videoSideListItemLoadingLayer"
            style={{ opacity: loading ? '1' : '0' }}
          >
            <Loading3QuartersOutlined spin={true} />
          </div>
          <div className={`videoSideListItemThumbnailLayer videoSideListItemIconLayer${loadError ? '' : ' videoSideListItemThumbnailMediaIcon'}`}>
            <PlayCircleFilled />
          </div>
        </div>
        <div className="videoSideListItemTextCtn">
          {(playingFileName === item.name)
            ? <b><PlayCircleFilled style={{ marginRight: '0.3rem' }} />{item.name}{item.encrypted ? ' *' : ''}</b>
            : <>{(item.name.length) > 45 ? (item.name.slice(0, 45) + '...') : item.name}{item.encrypted ? ' *' : ''}</>
          }
          <div className="videoSideListItemTextSecondary">{item.modifiedTime ? dayjs(item.modifiedTime).format('YYYY-MM-DD HH:mm:ss') : '-'}</div>
          {(playingFileName !== item.name) && <div className="videoSideListItemTextOperation">
            <Button
              type="link"
              size="small"
              className="videoSideListItemDelete"
              onClick={(e) => {
                e.preventDefault();
                handleDeleteClick(item.name);
              }}
            >{t('Delete')}</Button>
          </div>}
        </div>
      </Link>
    </List.Item>
  );
}

export default VideSideListItem;