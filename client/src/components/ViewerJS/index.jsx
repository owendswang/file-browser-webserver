import React, { useEffect, useRef } from "react";
import viewerjs from 'viewerjs';
import 'viewerjs/dist/viewer.css';
import '@/components/ViewerJS/index.css';

const ViewerJS = (props) => {
  const { children, options, visible, setVisible, showCustomNavBtn, ...otherProps } = props;

  const containerRef = useRef(null);
  const viewerInstance = useRef(null);

  useEffect(() => {
    // console.log(visible, containerRef.current);
    if (containerRef.current && (visible || options.inline)) {
      viewerInstance.current = new viewerjs(containerRef.current, {
        ...options,
        // inline: false,
        focus: false,
        hidden() {
          viewerInstance.current.destroy();
          viewerInstance.current = null;
          if (!options.inline) {
            setVisible(false);
          }
        },
        ready() {
          if (showCustomNavBtn) {
            const nextBtn = document.createElement('button');
            const prevBtn = document.createElement('button');
            prevBtn.className = 'custom-prev-btn';
            nextBtn.className = 'custom-next-btn';
            viewerInstance.current.viewer.appendChild(prevBtn);
            viewerInstance.current.viewer.appendChild(nextBtn);
            prevBtn.addEventListener('click', function() {
              viewerInstance.current.prev();
            });
            nextBtn.addEventListener('click', function() {
              viewerInstance.current.next();
            });
          }
        },
      });

      if (!options.inline) {
        viewerInstance.current.show();
      }
    }

    return () => {
      if (viewerInstance.current) {
        viewerInstance.current.destroy();
      }
    };
  }, [visible, options]);

  return (
    <div ref={containerRef} {...otherProps}>
      {children}
    </div>
  );
}

export default ViewerJS;