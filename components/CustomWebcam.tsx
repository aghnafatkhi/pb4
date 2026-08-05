import React, { useRef, useEffect, forwardRef, useImperativeHandle } from 'react';

export interface CustomWebcamProps {
  onUserMediaError?: (err: Error) => void;
  className?: string;
  style?: React.CSSProperties;
}

export interface CustomWebcamRef {
  getScreenshot: () => string | null;
}

export const CustomWebcam = forwardRef<CustomWebcamRef, CustomWebcamProps>(({ onUserMediaError, className, style }, ref) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    const startVideo = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 960 } },
          audio: false,
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err: any) {
        if (onUserMediaError) onUserMediaError(err);
      }
    };
    startVideo();
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [onUserMediaError]);

  useImperativeHandle(ref, () => ({
    getScreenshot: () => {
      if (!videoRef.current) return null;
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      
      const targetRatio = 3 / 4;
      const videoRatio = video.videoWidth / video.videoHeight;
      let drawWidth = video.videoWidth;
      let drawHeight = video.videoHeight;
      let startX = 0;
      let startY = 0;

      if (videoRatio > targetRatio) {
        drawWidth = video.videoHeight * targetRatio;
        startX = (video.videoWidth - drawWidth) / 2;
      } else {
        drawHeight = video.videoWidth / targetRatio;
        startY = (video.videoHeight - drawHeight) / 2;
      }

      canvas.width = drawWidth;
      canvas.height = drawHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Mirror the screenshot to match the mirrored video
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, startX, startY, drawWidth, drawHeight, 0, 0, drawWidth, drawHeight);
        return canvas.toDataURL('image/jpeg', 0.9);
      }
      return null;
    }
  }));

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted
      className={className}
      style={{ ...style, objectFit: 'cover' }}
    />
  );
});
CustomWebcam.displayName = 'CustomWebcam';
