import React, { useEffect, useRef } from 'react';
import videojs from "!video.js";
import '!style-loader!css-loader!video.js/dist/video-js.css';
import '!videojs-hls-quality-selector';
import "@/components/VideoJS/index.css";

export const VideoJS = (props) => {
  const {options, onReady, ...otherProps } = props;

  const videoRef = useRef(null);
  const playerRef = useRef(null);
  const volumeChangedByButtonTimeoutRef = useRef(null);
  const rotationRef = useRef(0);

  const showVolumeControl = () => {
    const volumePanel = document.querySelector('div.vjs-volume-panel.vjs-control.vjs-volume-panel-vertical');

    volumePanel.classList.add('vjs-hover');
    if (volumeChangedByButtonTimeoutRef.current) {
      clearTimeout(volumeChangedByButtonTimeoutRef.current);
    }
    if (!volumePanel.matches(':hover')) {
      volumeChangedByButtonTimeoutRef.current = setTimeout(() => {
        volumePanel.classList.remove('vjs-hover');
      }, 500);
    }
  }

  const handleKeyDown = (event) => {
    const player = playerRef.current;
    if (!player) return;

    event.preventDefault();
    switch (event.key) {
      case ' ':
        if (player.paused()) {
          player.play();
        } else {
          player.pause();
        }
        break;
      case 'ArrowRight':
        player.currentTime(Math.min(player.currentTime() + 5, player.duration()));
        break;
      case 'ArrowLeft':
        player.currentTime(Math.max(player.currentTime() - 5, 0));
        break;
      case 'ArrowUp':
        if (player.muted()) {
          player.muted(false);
        }
        player.volume(Math.min(1, player.volume() + 0.05));
        showVolumeControl();
        break;
      case 'ArrowDown':
        if (player.muted()) {
          player.muted(false);
        }
        player.volume(Math.max(0, player.volume() - 0.05));
        showVolumeControl();
        break;
      case 'f':
      case 'F':
        if (player.isFullscreen()) {
          player.exitFullscreen();
        } else {
          player.requestFullscreen();
        }
        break;
      case 'm':
      case 'M':
        if (player.muted()) {
          player.muted(false);
        } else {
          player.muted(true);
        }
        break;
      default:
        break;
    }
  };

  useEffect(() => {
    // Make sure Video.js player is only initialized once
    if (!playerRef.current) {
      // The Video.js player needs to be _inside_ the component el for React 18 Strict Mode. 
      const videoElement = document.createElement("video-js");

      videoElement.classList.add('vjs-big-play-centered');
      videoRef.current.appendChild(videoElement);

      const player = playerRef.current = videojs(videoElement, {
        ...options,
        muted: true,
        plugins: {},
        html5: {
          nativeTextTracks: false,
          vhs: {
            overrideNative: true,
          },
          nativeAudioTracks: false,
          nativeVideoTracks: false,
        },
      }, () => {
        // videojs.log('player is ready');
        // videojs.log(videojs.log.level());
        onReady && onReady(player);

        videoElement.focus();

        /*const qualityLevels = player.qualityLevels();
        // console.log(qualityLevels);
        let resList = [];
        qualityLevels.on('addqualitylevel', function(event) {
          const qualityLevel = event.qualityLevel;
          videojs.log(qualityLevel);
          const originalUrl = options.sources[1].src;
          const childSrc = originalUrl.replace('/index.m3u8', qualityLevel.id.split('-')[1]);
          resList.push({
            label: qualityLevel.id.match(/index_(\d+p)\.m3u8/)[1].toUpperCase(),
            value: childSrc
          });
        });
        qualityLevels.on('change', function(e) {
          videojs.log(e.selectedIndex);
        });*/

        // 使用 `videojs-hls-quality-selector` 插件
        //if (resList.length > 0) {
          player.hlsQualitySelector({
            displayCurrentQuality: true,
          });
        //}

        player.volume(window.localStorage.getItem('volume') ? parseFloat(window.localStorage.getItem('volume')) : 50);

        player.muted(window.localStorage.getItem('muted') ? window.localStorage.getItem('muted') === 'true' : true);

        player.on('volumechange', function(e) {
          window.localStorage.setItem('volume', this.volume().toString());
          window.localStorage.setItem('muted', this.muted().toString());
        });

        const volumePanel = document.querySelector('div.vjs-volume-panel.vjs-control.vjs-volume-panel-vertical');
        volumePanel.addEventListener('mouseover', (e) => {
          if (volumeChangedByButtonTimeoutRef.current) {
            clearTimeout(volumeChangedByButtonTimeoutRef.current);
            volumeChangedByButtonTimeoutRef.current = null;
          }
        })

        // Add keydown event to the video element
        videoElement.addEventListener('keydown', handleKeyDown);

        // Add rotate buttons
        /*const Button = videojs.getComponent('Button');

        class RotateLeftButton extends Button {
          constructor(player, options) {
            super(player, options);
            this.addClass('vjs-rotate-left-btn');
            this.controlText('Rotate Left');
          }
          handleClick() {
            rotationRef.current = (rotationRef.current - 90) % 360;
            const videoTag = videoElement.querySelector('video');
            if (videoTag) {
              videoTag.style.transform = `rotate(${rotationRef.current}deg)`;
              videoTag.style.transformOrigin = 'center center';
              adjustVideoFit(videoTag);
            }
          }
        }

        class RotateRightButton extends Button {
          constructor(player, options) {
            super(player, options);
            this.addClass('vjs-rotate-right-btn');
            this.controlText('Rotate Right');
          }
          handleClick() {
            rotationRef.current = (rotationRef.current + 90) % 360;
            const videoTag = videoElement.querySelector('video');
            if (videoTag) {
              videoTag.style.transform = `rotate(${rotationRef.current}deg)`;
              videoTag.style.transformOrigin = 'center center';
              adjustVideoFit(videoTag);
            }
          }
        }

        videojs.registerComponent('RotateLeftButton', RotateLeftButton);
        videojs.registerComponent('RotateRightButton', RotateRightButton);

        player.getChild('controlBar').addChild('RotateLeftButton', {});
        player.getChild('controlBar').addChild('RotateRightButton', {});
        */
      });

    // You could update an existing player in the `else` block here
    // on prop change, for example:
    } else {
      const player = playerRef.current;

      player.autoplay(options.autoplay);
      player.src(options.sources);
    }
  }, [options, videoRef]);

  // Dispose the Video.js player when the functional component unmounts
  useEffect(() => {
    const player = playerRef.current;

    return () => {
      if (player && !player.isDisposed()) {
        player.dispose();
        playerRef.current = null;
      }
    };
  }, [playerRef]);
/*
  const adjustVideoFit = (videoTag) => {
    const isRotated = Math.abs(rotationRef.current) % 180 !== 0;
    if (isRotated) {
      videoTag.style.width = 'auto';
      videoTag.style.height = '100%';
    } else {
      videoTag.style.width = '100%';
      videoTag.style.height = 'auto';
    }
    videoTag.style.objectFit = 'contain';
  };
*/
  return (
    <div data-vjs-player ref={videoRef} {...otherProps} className="video-player" />
  );
}

export default VideoJS;