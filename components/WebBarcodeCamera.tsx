import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { decodeFromVideo, decodeImageFile } from '../lib/scan/decodeBarcode';

export type WebBarcodeCameraHandle = {
  capture: () => Promise<string | null>;
  decodeFile: (file: Blob) => Promise<string | null>;
};

type Props = {
  /** Camera runs only while Scan is on screen and we are not showing a result. */
  active?: boolean;
  onStatus?: (msg: string) => void;
};

/**
 * Preview only. No live decode loop — parent calls capture() when the
 * person taps Read barcode.
 */
export const WebBarcodeCamera = forwardRef<WebBarcodeCameraHandle, Props>(function WebBarcodeCamera(
  { active, onStatus },
  ref,
) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [tapToStart, setTapToStart] = useState(false);
  const onStatusRef = useRef(onStatus);
  onStatusRef.current = onStatus;

  const stopStream = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    const video = videoRef.current;
    if (video) video.srcObject = null;
  };

  const startStream = async () => {
    if (streamRef.current) return;
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      onStatusRef.current?.('This browser cannot open the camera. Type the number instead.');
      return;
    }
    onStatusRef.current?.('Starting camera…');
    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
      }
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) {
        stream.getTracks().forEach(t => t.stop());
        streamRef.current = null;
        return;
      }
      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;
      video.setAttribute('playsinline', 'true');
      video.setAttribute('webkit-playsinline', 'true');
      try {
        await video.play();
        setTapToStart(false);
        onStatusRef.current?.('Tap Read barcode when the bars are in the frame');
      } catch {
        setTapToStart(true);
        onStatusRef.current?.('Tap the picture to start the camera');
      }
    } catch (e: any) {
      const name = String(e?.name || e?.message || e);
      if (/NotAllowed|Permission/i.test(name)) {
        onStatusRef.current?.('Camera permission is off. Type the number, or allow camera and reopen Scan.');
      } else if (/NotFound|DevicesNotFound/i.test(name)) {
        onStatusRef.current?.('No camera found. Type the number instead.');
      } else {
        onStatusRef.current?.('Camera did not start. Type the number instead.');
      }
    }
  };

  useImperativeHandle(ref, () => ({
    capture: async () => {
      const video = videoRef.current;
      if (!video) return null;
      if (!streamRef.current) await startStream();
      if (video.paused) {
        try { await video.play(); } catch { /* still try the frame */ }
      }
      if (video.readyState < 2) return null;
      return decodeFromVideo(video, { tryHarder: true });
    },
    decodeFile: (file: Blob) => decodeImageFile(file),
  }));

  useEffect(() => {
    if (active) startStream();
    else stopStream();
    return () => stopStream();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const onTapVideo = async () => {
    if (tapToStart) {
      try {
        await videoRef.current?.play();
        setTapToStart(false);
        onStatusRef.current?.('Tap Read barcode when the bars are in the frame');
      } catch {
        startStream();
      }
    }
  };

  if (!active) return <View style={styles.wrap} />;

  return (
    <View style={styles.wrap}>
      {React.createElement('video', {
        ref: (node: HTMLVideoElement | null): void => {
          videoRef.current = node;
        },
        autoPlay: true,
        muted: true,
        playsInline: true,
        onClick: onTapVideo,
        style: {
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          background: '#0b1220',
        },
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0b1220',
    overflow: 'hidden',
  },
});
