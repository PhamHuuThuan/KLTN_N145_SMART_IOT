import React, { useMemo, memo, useState, useCallback } from 'react';
import { View, StyleSheet, Dimensions, Platform, PanResponder, Text } from 'react-native';
import Svg, { Path, Circle, Line, G, Text as SvgText } from 'react-native-svg';
import { useTheme } from '../contexts/ThemeContext';

const PADDING_X = 50; // Tăng padding để chỗ cho Y axis labels
const PADDING_Y = 40; // Tăng padding để chỗ cho X axis labels
const PADDING_BOTTOM = 20;
const PADDING_LEFT = 10;
const MAX_POINTS = 15;
const MIN_HEIGHT = 120;
const TOUCH_TOLERANCE = 30; // Khoảng cách tối đa để chọn điểm
const Y_AXIS_LABELS = 5; // Số labels trên trục Y
const X_AXIS_LABELS = 5; // Số labels trên trục X

const SensorChart = memo(({ data, color, height = 160, onPointSelect, rawData = [] }) => {
  const { colors } = useTheme();
  const [selectedIndex, setSelectedIndex] = useState(null);

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
      const rawTimestamps = data.timestamps || [];
      const len = rawValues.length;
      if (!len) return null;

      const numeric = [];
      const timestamps = [];
      for (let i = 0; i < len; i++) {
        const v = Number(rawValues[i]);
        if (!isNaN(v) && isFinite(v)) {
          numeric.push(v);
          timestamps.push(rawTimestamps[i] || null);
        }
      }

      if (!numeric.length) return null;

      let values = numeric;
      let ts = timestamps;
      if (numeric.length > MAX_POINTS) {
        const step = Math.ceil(numeric.length / MAX_POINTS);
        const tmp = [];
        const tmpTs = [];
        for (let i = 0; i < numeric.length; i += step) {
          tmp.push(numeric[i]);
          tmpTs.push(timestamps[i]);
        }
        if (tmp[tmp.length - 1] !== numeric[numeric.length - 1]) {
          tmp.push(numeric[numeric.length - 1]);
          tmpTs.push(timestamps[timestamps.length - 1]);
        }
        values = tmp;
        ts = tmpTs;
      }

      const minValue = Math.min(...values);
      const maxValue = Math.max(...values);
      const valueRange = maxValue - minValue || 1;

      console.log('[SensorChart] prepared values:', values.length);

      return { values, timestamps: ts, minValue, valueRange };
    } catch (e) {
      console.log('[SensorChart] prepare error:', e);
      return null;
    }
  }, [data]);

  if (!prepared) return null;

  const chartHeight = Math.max(height, MIN_HEIGHT);
  const chartAreaWidth = Math.max(0, chartWidth - PADDING_X - PADDING_LEFT);
  const chartAreaHeight = Math.max(0, chartHeight - PADDING_Y - PADDING_BOTTOM);

  if (chartAreaWidth <= 0 || chartAreaHeight <= 0 || chartWidth <= 0) {
    return null;
  }

  // Tính toán tọa độ các điểm dựa trên timestamp thực tế
  const points = useMemo(() => {
    try {
      const { values, timestamps, minValue, valueRange } = prepared;
      if (!values.length || chartAreaWidth <= 0 || chartAreaHeight <= 0) {
        return { points: [], minTime: Date.now(), maxTime: Date.now(), minValue: 0, maxValue: 1 };
      }

      const pxPerPoint = Platform.OS === 'web' ? 8 : 15;
      const maxPointsForWidth = Math.min(MAX_POINTS, Math.floor(chartAreaWidth / pxPerPoint));

      let finalValues = values;
      let finalTimestamps = timestamps;
      if (values.length > maxPointsForWidth) {
        const step = Math.ceil(values.length / maxPointsForWidth);
        const tmp = [];
        const tmpTs = [];
        for (let i = 0; i < values.length; i += step) {
          tmp.push(values[i]);
          tmpTs.push(timestamps[i]);
        }
        if (tmp[tmp.length - 1] !== values[values.length - 1]) {
          tmp.push(values[values.length - 1]);
          tmpTs.push(timestamps[timestamps.length - 1]);
        }
        finalValues = tmp;
        finalTimestamps = tmpTs;
      }

      if (Platform.OS !== 'web' && finalValues.length > MAX_POINTS) {
        finalValues = finalValues.slice(0, MAX_POINTS);
        finalTimestamps = finalTimestamps.slice(0, MAX_POINTS);
      }

      // Tính X dựa trên timestamp thực tế, không chia đều
      const validTimestamps = finalTimestamps.filter(ts => ts instanceof Date && !isNaN(ts.getTime()));
      let timeRange = 1;
      let minTime = Date.now();
      let maxTime = Date.now();

      if (validTimestamps.length > 0) {
        minTime = Math.min(...validTimestamps.map(ts => ts.getTime()));
        maxTime = Math.max(...validTimestamps.map(ts => ts.getTime()));
        timeRange = maxTime - minTime || 1;
      }

      const pointsArray = [];
      finalValues.forEach((v, idx) => {
        let x = PADDING_X;
        
        // Nếu có timestamp hợp lệ, tính X theo timestamp
        if (finalTimestamps[idx] instanceof Date && !isNaN(finalTimestamps[idx].getTime())) {
          const timeRatio = (finalTimestamps[idx].getTime() - minTime) / timeRange;
          x = PADDING_X + chartAreaWidth * timeRatio;
        } else {
          // Fallback: chia đều theo index
          const lastIndex = Math.max(1, finalValues.length - 1);
          x = PADDING_X + (chartAreaWidth * idx) / lastIndex;
        }

        const ratio = (v - minValue) / valueRange;
        const y = PADDING_Y + chartAreaHeight - ratio * chartAreaHeight;

        const safeX = isNaN(x) ? PADDING_X : Math.min(PADDING_X + chartAreaWidth, Math.max(PADDING_X, x));
        const safeY = isNaN(y) ? PADDING_Y + chartAreaHeight : Math.min(PADDING_Y + chartAreaHeight, Math.max(PADDING_Y, y));

        pointsArray.push({
          x: safeX,
          y: safeY,
          value: v,
          timestamp: finalTimestamps[idx],
          index: idx,
        });
      });

      return { points: pointsArray, minTime, maxTime, minValue, maxValue: minValue + valueRange };
    } catch (e) {
      console.log('[SensorChart] points error:', e);
      return { points: [], minTime: Date.now(), maxTime: Date.now(), minValue: 0, maxValue: 1 };
    }
  }, [prepared, chartAreaWidth, chartAreaHeight]);

  const pathD = useMemo(() => {
    try {
      if (!points.points || !points.points.length) return '';

      const precision = Platform.OS === 'web' ? 2 : 1;
      let d = '';

      points.points.forEach((point, idx) => {
        if (idx === 0) {
          d = `M ${point.x.toFixed(precision)} ${point.y.toFixed(precision)}`;
        } else {
          d += ` L ${point.x.toFixed(precision)} ${point.y.toFixed(precision)}`;
        }
      });

      return d;
    } catch (e) {
      console.log('[SensorChart] path error:', e);
      return '';
    }
  }, [points]);

  // Tìm điểm gần nhất với tọa độ touch (ưu tiên theo trục X)
  const findNearestPoint = useCallback((touchX, touchY) => {
    if (!points.points || !points.points.length) return null;

    // Tìm điểm gần nhất theo trục X (dễ chọn hơn)
    let minXDistance = Infinity;
    let nearestPoint = null;

    points.points.forEach((point) => {
      const xDistance = Math.abs(touchX - point.x);
      // Chỉ chọn nếu trong phạm vi cho phép và gần nhất theo X
      if (xDistance < minXDistance && xDistance <= TOUCH_TOLERANCE) {
        minXDistance = xDistance;
        nearestPoint = point;
      }
    });

    return nearestPoint;
  }, [points]);

  // PanResponder để handle touch
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (evt) => {
          const { locationX, locationY } = evt.nativeEvent;
          const point = findNearestPoint(locationX, locationY);
          if (point) {
            setSelectedIndex(point.index);
            if (onPointSelect) {
              onPointSelect(point, rawData);
            }
          } else {
            setSelectedIndex(null);
          }
        },
        onPanResponderMove: (evt) => {
          const { locationX, locationY } = evt.nativeEvent;
          const point = findNearestPoint(locationX, locationY);
          if (point) {
            setSelectedIndex(point.index);
            if (onPointSelect) {
              onPointSelect(point, rawData);
            }
          } else {
            setSelectedIndex(null);
          }
        },
        onPanResponderRelease: () => {
          // Giữ selection sau khi release
        },
      }),
    [findNearestPoint, onPointSelect, rawData]
  );

  if (!pathD || !points.points || !points.points.length) return null;

  const selectedPoint = selectedIndex !== null ? points.points[selectedIndex] : null;

  // Tính toán Y axis labels
  const yAxisLabels = useMemo(() => {
    const labels = [];
    const { minValue, maxValue } = points;
    const valueRange = maxValue - minValue || 1;
    
    for (let i = 0; i < Y_AXIS_LABELS; i++) {
      const ratio = i / (Y_AXIS_LABELS - 1);
      const value = minValue + valueRange * (1 - ratio); // Đảo ngược vì Y tăng từ trên xuống
      const y = PADDING_Y + chartAreaHeight * ratio;
      labels.push({ value, y });
    }
    return labels;
  }, [points, chartAreaHeight]);

  // Tính toán X axis labels
  const xAxisLabels = useMemo(() => {
    const labels = [];
    const { minTime, maxTime } = points;
    const timeRange = maxTime - minTime || 1;
    
    for (let i = 0; i < X_AXIS_LABELS; i++) {
      const ratio = i / (X_AXIS_LABELS - 1);
      const time = minTime + timeRange * ratio;
      const x = PADDING_X + chartAreaWidth * ratio;
      const date = new Date(time);
      
      // Format: HH:mm hoặc dd/MM nếu khoảng thời gian > 1 ngày
      const isLongRange = timeRange > 24 * 60 * 60 * 1000;
      const label = isLongRange
        ? date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })
        : date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
      
      labels.push({ label, x, time });
    }
    return labels;
  }, [points, chartAreaWidth]);

  return (
    <View
      style={[styles.container, { width: chartWidth, height: chartHeight }]}
      {...panResponder.panHandlers}
    >
      <Svg width={chartWidth} height={chartHeight} viewBox={`0 0 ${chartWidth} ${chartHeight}`}>
        {/* Y Axis Grid Lines & Labels */}
        {yAxisLabels.map((item, idx) => (
          <G key={`y-${idx}`}>
            {/* Grid line */}
            <Line
              x1={PADDING_X}
              y1={item.y}
              x2={PADDING_X + chartAreaWidth}
              y2={item.y}
              stroke={colors.border || '#E0E0E0'}
              strokeWidth={0.5}
              opacity={0.5}
            />
            {/* Y axis label */}
            <SvgText
              x={PADDING_X - 8}
              y={item.y + 4}
              fontSize="10"
              fill={colors.textSecondary || '#666'}
              textAnchor="end"
            >
              {item.value.toFixed(1)}
            </SvgText>
          </G>
        ))}

        {/* X Axis Grid Lines & Labels */}
        {xAxisLabels.map((item, idx) => (
          <G key={`x-${idx}`}>
            {/* Grid line */}
            <Line
              x1={item.x}
              y1={PADDING_Y}
              x2={item.x}
              y2={PADDING_Y + chartAreaHeight}
              stroke={colors.border || '#E0E0E0'}
              strokeWidth={0.5}
              opacity={0.5}
            />
            {/* X axis label */}
            <SvgText
              x={item.x}
              y={chartHeight - 8}
              fontSize="10"
              fill={colors.textSecondary || '#666'}
              textAnchor="middle"
            >
              {item.label}
            </SvgText>
          </G>
        ))}

        {/* Chart line */}
        <Path
          d={pathD}
          fill="none"
          stroke={color || colors.primary}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        
        {/* Selected point marker */}
        {selectedPoint && (
          <G>
            {/* Vertical line */}
            <Line
              x1={selectedPoint.x}
              y1={PADDING_Y}
              x2={selectedPoint.x}
              y2={PADDING_Y + chartAreaHeight}
              stroke={colors.textSecondary}
              strokeWidth={1.5}
              strokeDasharray="4,4"
              opacity={0.7}
            />
            {/* Point circle */}
            <Circle
              cx={selectedPoint.x}
              cy={selectedPoint.y}
              r={7}
              fill={color || colors.primary}
              stroke={colors.background || '#FFFFFF'}
              strokeWidth={2.5}
            />
            {/* Tooltip value */}
            <G>
              <SvgText
                x={selectedPoint.x}
                y={selectedPoint.y - 12}
                fontSize="11"
                fontWeight="600"
                fill={color || colors.primary}
                textAnchor="middle"
              >
                {selectedPoint.value.toFixed(1)}
              </SvgText>
            </G>
          </G>
        )}
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
