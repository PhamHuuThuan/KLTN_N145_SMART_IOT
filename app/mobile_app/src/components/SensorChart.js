import React, { useMemo, memo } from 'react';
import { View, StyleSheet, Dimensions, Platform } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../contexts/ThemeContext';

const PADDING_X = 20;
const PADDING_Y = 20;
const MAX_POINTS = 15;
const MIN_HEIGHT = 120;

const SensorChart = memo(({ data, color, height = 160 }) => {
  const { colors } = useTheme();

  const chartWidth = useMemo(() => {
    try {
      const { width: SCREEN_WIDTH } = Dimensions.get('window');
      const calculatedWidth = SCREEN_WIDTH - 60;
      const maxWidth = Platform.OS === 'web' ? 600 : 350;
      return Math.min(calculatedWidth, maxWidth);
    } catch {
      return 350;
    }
  }, []);

  const prepared = useMemo(() => {
    try {
      if (!data || !Array.isArray(data.values)) {
        console.log('[SensorChart] no data or invalid');
        return null;
      }

      const rawValues = data.values;
      const len = rawValues.length;
      if (!len) return null;

      const numeric = [];
      for (let i = 0; i < len; i++) {
        const v = Number(rawValues[i]);
        if (!isNaN(v) && isFinite(v)) {
          numeric.push(v);
        }
      }

      if (!numeric.length) return null;

      let values = numeric;
      if (numeric.length > MAX_POINTS) {
        const step = Math.ceil(numeric.length / MAX_POINTS);
        const tmp = [];
        for (let i = 0; i < numeric.length; i += step) {
          tmp.push(numeric[i]);
        }
        if (tmp[tmp.length - 1] !== numeric[numeric.length - 1]) {
          tmp.push(numeric[numeric.length - 1]);
        }
        values = tmp;
      }

      const minValue = Math.min(...values);
      const maxValue = Math.max(...values);
      const valueRange = maxValue - minValue || 1;

      console.log('[SensorChart] prepared values:', values.length);

      return { values, minValue, valueRange };
    } catch (e) {
      console.log('[SensorChart] prepare error:', e);
      return null;
    }
  }, [data]);

  if (!prepared) return null;

  const chartHeight = Math.max(height, MIN_HEIGHT);
  const chartAreaWidth = Math.max(0, chartWidth - PADDING_X * 2);
  const chartAreaHeight = Math.max(0, chartHeight - PADDING_Y * 2);

  if (chartAreaWidth <= 0 || chartAreaHeight <= 0 || chartWidth <= 0) {
    return null;
  }

  const pathD = useMemo(() => {
    try {
      const { values, minValue, valueRange } = prepared;
      if (!values.length || chartAreaWidth <= 0 || chartAreaHeight <= 0) return '';

      const pxPerPoint = Platform.OS === 'web' ? 8 : 15;
      const maxPointsForWidth = Math.min(MAX_POINTS, Math.floor(chartAreaWidth / pxPerPoint));

      let finalValues = values;
      if (values.length > maxPointsForWidth) {
        const step = Math.ceil(values.length / maxPointsForWidth);
        const tmp = [];
        for (let i = 0; i < values.length; i += step) {
          tmp.push(values[i]);
        }
        if (tmp[tmp.length - 1] !== values[values.length - 1]) {
          tmp.push(values[values.length - 1]);
        }
        finalValues = tmp;
      }

      if (Platform.OS !== 'web' && finalValues.length > MAX_POINTS) {
        finalValues = finalValues.slice(0, MAX_POINTS);
      }

      const lastIndex = Math.max(1, finalValues.length - 1);
      const precision = Platform.OS === 'web' ? 2 : 1;

      let d = '';

      finalValues.forEach((v, idx) => {
        const x = PADDING_X + (chartAreaWidth * idx) / lastIndex;
        const ratio = (v - minValue) / valueRange;
        const y = PADDING_Y + chartAreaHeight - ratio * chartAreaHeight;

        const safeX = isNaN(x) ? PADDING_X : Math.min(PADDING_X + chartAreaWidth, Math.max(PADDING_X, x));
        const safeY = isNaN(y) ? PADDING_Y + chartAreaHeight : Math.min(PADDING_Y + chartAreaHeight, Math.max(PADDING_Y, y));

        if (idx === 0) {
          d = `M ${safeX.toFixed(precision)} ${safeY.toFixed(precision)}`;
        } else {
          d += ` L ${safeX.toFixed(precision)} ${safeY.toFixed(precision)}`;
        }
      });

      return d;
    } catch (e) {
      console.log('[SensorChart] path error:', e);
      return '';
    }
  }, [prepared, chartAreaWidth, chartAreaHeight]);

  if (!pathD) return null;

  return (
    <View style={[styles.container, { width: chartWidth, height: chartHeight }]}>
      <Svg width={chartWidth} height={chartHeight} viewBox={`0 0 ${chartWidth} ${chartHeight}`}>
        <Path
          d={pathD}
          fill="none"
          stroke={color || colors.primary}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});

SensorChart.displayName = 'SensorChart';

export default SensorChart;
