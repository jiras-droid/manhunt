import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import { buildMapHtml } from './mapHtml';

export type MapPin = {
  id: string;
  lat: number;
  lng: number;
  emoji: string;
  color: string;
  role: 'hider' | 'seeker' | 'out' | 'none';
  kind: 'live' | 'ping';
  label: string;
};

export type GameMapHandle = {
  center: (lat: number, lng: number, zoom?: number) => void;
  fitArea: () => void;
};

type Props = {
  area: [number, number][] | null;
  drawMode?: boolean;
  showMask?: boolean;
  fitToArea?: boolean;
  interactive?: boolean;
  me?: { lat: number; lng: number } | null;
  pins?: MapPin[];
  initialCenter?: { lat: number; lng: number } | null;
  onAreaDrawn?: (area: [number, number][]) => void;
  onDrawTooSmall?: () => void;
};

const html = buildMapHtml();

export const GameMap = forwardRef<GameMapHandle, Props>(function GameMap(
  { area, drawMode = false, showMask = false, fitToArea = false, interactive = true, me, pins, initialCenter, onAreaDrawn, onDrawTooSmall },
  ref,
) {
  const web = useRef<WebView<{}>>(null);
  const [ready, setReady] = useState(false);
  const centered = useRef(false);
  const fitted = useRef(false);

  const post = useCallback(
    (msg: object) => {
      if (!ready) return;
      web.current?.injectJavaScript(`window.__recv && window.__recv(${JSON.stringify(msg)}); true;`);
    },
    [ready],
  );

  useImperativeHandle(ref, () => ({
    center: (lat, lng, zoom) => post({ type: 'center', lat, lng, zoom }),
    fitArea: () => post({ type: 'fitArea' }),
  }), [post]);

  useEffect(() => post({ type: 'setDrawMode', on: drawMode }), [post, drawMode]);
  useEffect(() => post({ type: 'setInteractive', on: interactive }), [post, interactive]);
  useEffect(() => {
    if (!ready) return;
    // only zoom to the area the first time, so later updates don't yank the map around
    const fit = fitToArea && !!area && !fitted.current;
    if (fit) fitted.current = true;
    post({ type: 'setArea', area, mask: showMask, fit });
  }, [ready, post, area, showMask, fitToArea]);
  useEffect(() => post({ type: 'setMe', lat: me?.lat, lng: me?.lng }), [post, me?.lat, me?.lng]);
  useEffect(() => post({ type: 'setPlayers', players: pins || [] }), [post, pins]);
  useEffect(() => {
    if (!ready || centered.current || !initialCenter || (fitToArea && area)) return;
    centered.current = true;
    post({ type: 'center', lat: initialCenter.lat, lng: initialCenter.lng, zoom: 16, instant: true });
  }, [ready, initialCenter, post, fitToArea, area]);

  const onMessage = useCallback(
    (e: WebViewMessageEvent) => {
      let msg: { type: string; area?: [number, number][]; message?: string };
      try {
        msg = JSON.parse(e.nativeEvent.data);
      } catch {
        return;
      }
      if (msg.type === 'ready') setReady(true);
      else if (msg.type === 'area' && msg.area) onAreaDrawn?.(msg.area);
      else if (msg.type === 'drawTooSmall') onDrawTooSmall?.();
      else if (msg.type === 'error') console.warn('map:', msg.message);
    },
    [onAreaDrawn, onDrawTooSmall],
  );

  const source = useMemo(() => ({ html, baseUrl: 'https://localhost/' }), []);

  return (
    <View style={StyleSheet.absoluteFill}>
      <WebView<{}>
        ref={web}
        source={source}
        originWhitelist={['*']}
        onMessage={onMessage}
        javaScriptEnabled
        domStorageEnabled
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        setBuiltInZoomControls={false}
        style={styles.web}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  web: { flex: 1, backgroundColor: '#ECE9E1' },
});
