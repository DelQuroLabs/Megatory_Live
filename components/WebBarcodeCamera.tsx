import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { decodeFromVideo, decodeImageFile } from '../lib/scan/decodeBarcode';

export type WebBarcodeCameraHandle = {
  capture: () => Promise<string | null>;
  decodeFile: (file: Blob) => Promise<string | null>;
};

type Props = {
  paused?: boolean;
  onDetect: (code: string) => void;
  onStatus?: (msg: string) => void;
};

/**
 * Own the <video> element. expo-camera's web path only scans QR via jsQR,
 * so bottle barcodes never fire. This stream is the same back camera,
 * with 1D reading and a shutter the parent can call.
 */
export const WebBarcodeCamera = forwardRef<WebBarcodeCameraHandle, Props>(function WebBarcodeCamera(
  { paused, onDetect, onStatus },
  ref,
) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const pausedRef = useRef(!!paused);
  const onDetectRef = useRef(onDetect);
  const busyRef = useRef(false);
  const [tapToStart, setTapToStart] = useState(false);

  pausedRef.current = !!paused;
  onDetectRef.current = onDetect;

  const stopStream = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    const video = videoRef.current;
    if (video) video.srcObject = null;
  };

  const startStream = async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      onStatus?.('This browser cannot open the camera. Type the number instead.');
      return;
    }
    onStatus?.('Starting camera…');
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
        onStatus?.('Point at the bars — or tap Read barcode');
      } catch {
        setTapToStart(true);
        onStatus?.('Tap the picture to start the camera');
      }
    } catch (e: any) {
      const name = String(e?.name || e?.message || e);
      if (/NotAllowed|Permission/i.test(name)) {
        onStatus?.('Camera permission is off. Type the number, or allow camera and reopen Scan.');
      } else if (/NotFound|DevicesNotFound/i.test(name)) {
        onStatus?.('No camera found. Type the number instead.');
      } else {
        onStatus?.('Camera did not start. Type the number instead.');
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
    startStream();
    return () => stopStream();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = async () => {
      if (!pausedRef.current && !busyRef.current) {
        const video = videoRef.current;
        if (video && video.readyState >= 2) {
          busyRef.current = true;
          try {
            const code = await decodeFromVideo(video, { tryHarder: false });
            if (code && !pausedRef.current) onDetectRef.current(code);
          } catch {
            // keep looping
          } finally {
            busyRef.current = false;
          }
        }
      }
      timer = setTimeout(tick, 450);
    };
    timer = setTimeout(tick, 700);
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, []);

  const onTapVideo = async () => {
    if (tapToStart) {
      try {
        await videoRef.current?.play();
        setTapToStart(false);
        onStatus?.('Point at the bars — or tap Read barcode');
      } catch {
        startStream();
      }
    }
  };

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
