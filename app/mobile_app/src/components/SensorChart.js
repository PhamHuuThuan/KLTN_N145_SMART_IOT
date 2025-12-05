import React, { useMemo, memo, useState, useCallback } from 'react';
import { View, StyleSheet, Dimensions, Platform, PanResponder, Text } from 'react-native';
import Svg, { Path, Circle, Line, G, Text as SvgText, Rect } from 'react-native-svg';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';

const PADDING_X = 50;
const PADDING_Y = 40; 
const PADDING_BOTTOM = 20;
const PADDING_LEFT = 10;
const MAX_POINTS = 800;
const MIN_HEIGHT = 120;
const TOUCH_TOLERANCE = 30;
const Y_AXIS_LABELS = 5;
const X_AXIS_LABELS = 5;

const THRESHOLDS = {
  temperature: { low: 15, normal: 40, high: 50 },
  humidity: { low: 30, normal: 80, high: 90 },
  gas: { low: 300, normal: 800, high: 1000 },
  smoke: { low: 1.5, normal: 3.4, high: 4.6 },
};

const LEVEL_COLORS_LIGHT = {
  low: '#90CAF9',
  normal: '#E0E0E0',
  high: '#FFB74D', 
  veryHigh: '#EF5350', 
};

const LEVEL_COLORS_DARK = {
  low:      '#1E3A8A',
  normal:   '#4B5563',
  high:     '#DC6A00',
  veryHigh: '#DC2626',
};

const SensorChart = memo(({ data, color, height = 160, onPointSelect, rawData = [], timeRange = null, isBinary = false, sensorType = null }) => {
  const { colors, isDarkMode } = useTheme();
  const { t } = useTranslation();
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [selectedVirtualPoint, setSelectedVirtualPoint] = useState(null);
  
  const LEVEL_COLORS = isDarkMode ? LEVEL_COLORS_DARK : LEVEL_COLORS_LIGHT;

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
        return null;
      }

      const rawValues = data.values;
      const rawTimestamps = data.timestamps || [];
      const rawIsGapPoints = data.isGapPoints || [];
      const len = rawValues.length;
      if (!len) return null;

      const numeric = [];
      const timestamps = [];
      const isGapPoints = [];
      for (let i = 0; i < len; i++) {
        const v = Number(rawValues[i]);
        numeric.push(isNaN(v) || !isFinite(v) ? 0 : v);
        timestamps.push(rawTimestamps[i] || null);
        isGapPoints.push(rawIsGapPoints[i] || false);
      }

      if (!numeric.length) return null;

      let values = numeric;
      let ts = timestamps;
      let gapPoints = isGapPoints;
      if (numeric.length > MAX_POINTS) {
        const targetPoints = MAX_POINTS;
        const step = Math.ceil(numeric.length / targetPoints);
        const tmp = [];
        const tmpTs = [];
        const tmpGaps = [];
        
        for (let i = 0; i < numeric.length; i += step) {
          tmp.push(numeric[i]);
          tmpTs.push(timestamps[i]);
          tmpGaps.push(isGapPoints[i]);
        }
        
        if (tmp[tmp.length - 1] !== numeric[numeric.length - 1]) {
          tmp.push(numeric[numeric.length - 1]);
          tmpTs.push(timestamps[timestamps.length - 1]);
          tmpGaps.push(isGapPoints[isGapPoints.length - 1]);
        }
        
        values = tmp;
        ts = tmpTs;
        gapPoints = tmpGaps;
      }

      let minValue = Math.min(...values);
      let maxValue = Math.max(...values);
      
      if (isBinary) {
        minValue = 0;
        maxValue = 1;
      } else {
        if (sensorType && THRESHOLDS[sensorType]) {
          const thresholds = THRESHOLDS[sensorType];
          minValue = Math.min(0, minValue, thresholds.low || minValue);
          maxValue = Math.max(maxValue, thresholds.high || maxValue);
        } else {
          if (minValue >= 0) {
            minValue = 0;
          }
        }
        if (minValue < 0 && maxValue < 0) {
          maxValue = 0;
        }
      }
      
      const valueRange = maxValue - minValue || 1;

      return { values, timestamps: ts, isGapPoints: gapPoints, minValue, maxValue, valueRange };
    } catch (e) {
      return null;
    }
  }, [data, sensorType]);

  if (!prepared) return null;

  const chartHeight = Math.max(height, MIN_HEIGHT);
  const chartAreaWidth = Math.max(0, chartWidth - PADDING_X - PADDING_LEFT);
  const chartAreaHeight = Math.max(0, chartHeight - PADDING_Y - PADDING_BOTTOM);

  if (chartAreaWidth <= 0 || chartAreaHeight <= 0 || chartWidth <= 0) {
    return null;
  }

  const points = useMemo(() => {
    try {
      const { values, timestamps, isGapPoints, minValue, maxValue, valueRange } = prepared;
      if (!values.length || chartAreaWidth <= 0 || chartAreaHeight <= 0) {
        return { points: [], minTime: Date.now(), maxTime: Date.now(), minValue: 0, maxValue: 1 };
      }

      const pxPerPoint = Platform.OS === 'web' ? 8 : 15;
      const maxPointsForWidth = Math.min(MAX_POINTS, Math.floor(chartAreaWidth / pxPerPoint));

      let finalValues = values;
      let finalTimestamps = timestamps;
      let finalIsGapPoints = isGapPoints || [];
      if (values.length > maxPointsForWidth) {
        const targetPoints = maxPointsForWidth;
        const step = Math.ceil(values.length / targetPoints);
        const tmp = [];
        const tmpTs = [];
        const tmpGaps = [];
        
        for (let i = 0; i < values.length; i += step) {
          tmp.push(values[i]);
          tmpTs.push(timestamps[i]);
          tmpGaps.push(isGapPoints[i] || false);
        }
        
        if (tmp[tmp.length - 1] !== values[values.length - 1]) {
          tmp.push(values[values.length - 1]);
          tmpTs.push(timestamps[timestamps.length - 1]);
          tmpGaps.push(isGapPoints[isGapPoints.length - 1] || false);
        }
        
        finalValues = tmp;
        finalTimestamps = tmpTs;
        finalIsGapPoints = tmpGaps;
      }

      if (Platform.OS !== 'web' && finalValues.length > MAX_POINTS) {
        finalValues = finalValues.slice(0, MAX_POINTS);
        finalTimestamps = finalTimestamps.slice(0, MAX_POINTS);
        finalIsGapPoints = finalIsGapPoints.slice(0, MAX_POINTS);
      }

      const validTimestamps = finalTimestamps.filter(ts => ts instanceof Date && !isNaN(ts.getTime()));
      let timeRangeMs = 1;
      let minTime = Date.now();
      let maxTime = Date.now();

      if (timeRange && timeRange.startTime && timeRange.endTime) {
        minTime = timeRange.startTime.getTime();
        maxTime = timeRange.endTime.getTime();
        timeRangeMs = maxTime - minTime || 1;
      } else if (validTimestamps.length > 0) {
        minTime = Math.min(...validTimestamps.map(ts => ts.getTime()));
        maxTime = Math.max(...validTimestamps.map(ts => ts.getTime()));
        timeRangeMs = maxTime - minTime || 1;
      }

      const pointsArray = [];
      finalValues.forEach((v, idx) => {
        let x = PADDING_X;
        
        if (finalTimestamps[idx] instanceof Date && !isNaN(finalTimestamps[idx].getTime())) {
          const timeRatio = (finalTimestamps[idx].getTime() - minTime) / timeRangeMs;
          x = PADDING_X + chartAreaWidth * timeRatio;
        } else {
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
          isGapPoint: finalIsGapPoints[idx] || false,
        });
      });

      return { points: pointsArray, minTime, maxTime, minValue, maxValue: minValue + valueRange };
    } catch (e) {
      return { points: [], minTime: Date.now(), maxTime: Date.now(), minValue: 0, maxValue: 1 };
    }
  }, [prepared, chartAreaWidth, chartAreaHeight, timeRange]);

  const pathD = useMemo(() => {
    try {
      if (!points.points || !points.points.length) return '';

      const precision = Platform.OS === 'web' ? 2 : 1;
      let d = '';
      
      const { minTime, maxTime } = points;
      const timeRangeMs = maxTime - minTime || 1;
      const timeThreshold = Math.max(10 * 60 * 1000, timeRangeMs * 0.05);

      if (isBinary) {
        points.points.forEach((point, idx) => {
          if (idx === 0) {
            d = `M ${point.x.toFixed(precision)} ${point.y.toFixed(precision)}`;
          } else {
            const prevPoint = points.points[idx - 1];
            if (prevPoint && prevPoint.timestamp && point.timestamp) {
              const timeGap = Math.abs(point.timestamp.getTime() - prevPoint.timestamp.getTime());
              
              if (timeGap > timeThreshold) {
                d += ` L ${prevPoint.x.toFixed(precision)} ${PADDING_Y + chartAreaHeight}`;
                d += ` M ${point.x.toFixed(precision)} ${point.y.toFixed(precision)}`;
              } else {
                d += ` L ${point.x.toFixed(precision)} ${prevPoint.y.toFixed(precision)}`;
                d += ` L ${point.x.toFixed(precision)} ${point.y.toFixed(precision)}`;
              }
            } else {
              d += ` L ${point.x.toFixed(precision)} ${point.y.toFixed(precision)}`;
            }
          }
        });
      } else {
        const { minValue, maxValue, minTime, maxTime } = points;
        const valueRange = maxValue - minValue || 1;
        const defaultValue = 0;
        const defaultRatio = (defaultValue - minValue) / valueRange;
        const defaultY = PADDING_Y + chartAreaHeight - (chartAreaHeight * Math.max(0, Math.min(1, defaultRatio)));
        
        const chartStartX = PADDING_X;
        const chartEndX = PADDING_X + chartAreaWidth;
        
        let needsStartConnection = false;
        if (points.points.length > 0) {
          const firstPoint = points.points[0];
          if (firstPoint.x > chartStartX + 5) {
            needsStartConnection = true;
          }
        }
        
        let needsEndConnection = false;
        if (points.points.length > 0) {
          const lastPoint = points.points[points.points.length - 1];
          if (lastPoint.x < chartEndX - 5) {
            needsEndConnection = true;
          }
        }
        
        if (needsStartConnection && points.points.length > 0) {
          const firstPoint = points.points[0];
          d = `M ${chartStartX.toFixed(precision)} ${defaultY.toFixed(precision)}`;
          d += ` L ${firstPoint.x.toFixed(precision)} ${defaultY.toFixed(precision)}`;
          d += ` L ${firstPoint.x.toFixed(precision)} ${firstPoint.y.toFixed(precision)}`;
        } else if (points.points.length > 0) {
          d = `M ${points.points[0].x.toFixed(precision)} ${points.points[0].y.toFixed(precision)}`;
        }
        
        points.points.forEach((point, idx) => {
          if (idx === 0 && !needsStartConnection) {
            return;
          }
          
          if (idx > 0) {
            const prevPoint = points.points[idx - 1];
            if (prevPoint && prevPoint.timestamp && point.timestamp) {
              const timeGap = Math.abs(point.timestamp.getTime() - prevPoint.timestamp.getTime());
              
              if (timeGap > timeThreshold) {

                d += ` L ${prevPoint.x.toFixed(precision)} ${defaultY.toFixed(precision)}`;
                d += ` L ${point.x.toFixed(precision)} ${defaultY.toFixed(precision)}`;
                d += ` L ${point.x.toFixed(precision)} ${point.y.toFixed(precision)}`;
              } else {
                d += ` L ${point.x.toFixed(precision)} ${point.y.toFixed(precision)}`;
              }
            } else {
              d += ` L ${point.x.toFixed(precision)} ${point.y.toFixed(precision)}`;
            }
          }
        });
        
        if (needsEndConnection && points.points.length > 0) {
          const lastPoint = points.points[points.points.length - 1];
          d += ` L ${lastPoint.x.toFixed(precision)} ${defaultY.toFixed(precision)}`;
          d += ` L ${chartEndX.toFixed(precision)} ${defaultY.toFixed(precision)}`;
        }
      }

      return d;
    } catch (e) {
      return '';
    }
  }, [points, isBinary, chartAreaHeight]);

  const binaryRectangles = useMemo(() => {
    if (!isBinary || !points.points || !points.points.length) return [];
    
    const rectangles = [];
    const baselineY = PADDING_Y + chartAreaHeight;
    const topY = PADDING_Y;
    let rectStartX = null;
    let prevValue = null;
    
    points.points.forEach((point, idx) => {
      const isOne = point.value === 1 || point.value > 0.5;
      
      if (isOne && (prevValue === null || prevValue === 0 || prevValue < 0.5)) {
        rectStartX = point.x;
      }
      
      if (!isOne && rectStartX !== null) {
        if (point.x > rectStartX) {
          rectangles.push({
            x: rectStartX,
            width: point.x - rectStartX,
            y: topY,
            height: baselineY - topY,
          });
        }
        rectStartX = null;
      }
      
      prevValue = point.value;
    });
    
    if (rectStartX !== null && points.points.length > 0) {
      const lastPoint = points.points[points.points.length - 1];
      if (lastPoint.x > rectStartX) {
        rectangles.push({
          x: rectStartX,
          width: lastPoint.x - rectStartX,
          y: topY,
          height: baselineY - topY,
        });
      }
    }
    
    return rectangles;
  }, [points, isBinary, chartAreaHeight]);

  const findNearestPoint = useCallback((touchX, touchY) => {
    if (!points.points || !points.points.length) return null;

    let minDistance = Infinity;
    let nearestPoint = null;

    points.points.forEach((point) => {
      const xDistance = Math.abs(touchX - point.x);
      const tolerance = point.isGapPoint ? TOUCH_TOLERANCE * 2 : TOUCH_TOLERANCE;
      
      if (point.isGapPoint) {
        const yDistance = Math.abs(touchY - point.y);
        const totalDistance = Math.sqrt(xDistance * xDistance + yDistance * yDistance);
        if (totalDistance <= tolerance && totalDistance < minDistance) {
          minDistance = totalDistance;
          nearestPoint = point;
        }
      } else {
        if (xDistance <= tolerance && xDistance < minDistance) {
          minDistance = xDistance;
          nearestPoint = point;
        }
      }
    });

    if (!nearestPoint && touchX >= PADDING_X && touchX <= PADDING_X + chartAreaWidth) {
      const { minValue, maxValue, minTime, maxTime } = points;
      const valueRange = maxValue - minValue || 1;
      
      let timestamp = null;
      if (timeRange && timeRange.startTime && timeRange.endTime) {
        const timeRangeMs = timeRange.endTime.getTime() - timeRange.startTime.getTime();
        const xRatio = (touchX - PADDING_X) / chartAreaWidth;
        const timeOffset = timeRangeMs * xRatio;
        timestamp = new Date(timeRange.startTime.getTime() + timeOffset);
      } else if (points.points.length > 0 && minTime && maxTime) {
        const timeRangeMs = maxTime - minTime || 1;
        const xRatio = (touchX - PADDING_X) / chartAreaWidth;
        const timeOffset = timeRangeMs * xRatio;
        timestamp = new Date(minTime + timeOffset);
      } else {
        timestamp = new Date();
      }
      
      const defaultValue = 0;
      const defaultRatio = (defaultValue - minValue) / valueRange;
      const defaultY = PADDING_Y + chartAreaHeight - (chartAreaHeight * Math.max(0, Math.min(1, defaultRatio)));
      
      nearestPoint = {
        x: touchX,
        y: defaultY,
        value: defaultValue,
        timestamp: timestamp,
        index: -1,
        isGapPoint: true,
      };
    }

    return nearestPoint;
  }, [points, timeRange, chartAreaWidth, chartAreaHeight]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (evt) => {
          const { locationX, locationY } = evt.nativeEvent;
          const point = findNearestPoint(locationX, locationY);
          if (point) {
            if (point.index === -1) {
              setSelectedIndex(null);
              setSelectedVirtualPoint(point);
            } else {
              setSelectedIndex(point.index);
              setSelectedVirtualPoint(null);
            }
            if (onPointSelect) {
              onPointSelect(point, rawData);
            }
          } else {
            setSelectedIndex(null);
            setSelectedVirtualPoint(null);
          }
        },
        onPanResponderMove: (evt) => {
          const { locationX, locationY } = evt.nativeEvent;
          const point = findNearestPoint(locationX, locationY);
          if (point) {
            if (point.index === -1) {
              setSelectedIndex(null);
              setSelectedVirtualPoint(point);
            } else {
              setSelectedIndex(point.index);
              setSelectedVirtualPoint(null);
            }
            if (onPointSelect) {
              onPointSelect(point, rawData);
            }
          } else {
            setSelectedIndex(null);
            setSelectedVirtualPoint(null);
          }
        },
        onPanResponderRelease: () => {

        },
      }),
    [findNearestPoint, onPointSelect, rawData]
  );

  if (!pathD || !points.points || !points.points.length) return null;

  const selectedPoint = selectedVirtualPoint || (selectedIndex !== null && selectedIndex >= 0 ? points.points[selectedIndex] : null);

  const zeroLineInfo = useMemo(() => {
    const { minValue, maxValue } = points;
    const valueRange = maxValue - minValue || 1;
    const hasNegativeValues = minValue < 0;
    const hasPositiveValues = maxValue >= 0;
    
    // Always show zero line if it's within or at the boundary of the chart
    if (hasNegativeValues || (minValue === 0 && hasPositiveValues)) {
      const zeroRatio = (0 - minValue) / valueRange;
      const zeroY = PADDING_Y + chartAreaHeight * (1 - zeroRatio);
      return { hasZeroLine: true, zeroY, zeroValue: 0 };
    } else if (minValue >= 0 && minValue === 0) {
      const zeroY = PADDING_Y + chartAreaHeight;
      return { hasZeroLine: true, zeroY, zeroValue: 0 };
    }
    return { hasZeroLine: false, zeroY: null, zeroValue: null };
  }, [points, chartAreaHeight]);

  const yAxisLabels = useMemo(() => {
    const labels = [];
    const { minValue, maxValue } = points;
    const valueRange = maxValue - minValue || 1;
    
    if (isBinary) {
      const zeroY = PADDING_Y + chartAreaHeight;
      const oneY = PADDING_Y;
      labels.push({ value: 0, y: zeroY, isZero: true });
      labels.push({ value: 1, y: oneY, isZero: false });
      return labels;
    }
    
    const hasNegativeValues = minValue < 0;
    
    if (hasNegativeValues) {
      const zeroRatio = (0 - minValue) / valueRange;
      const zeroY = PADDING_Y + chartAreaHeight * (1 - zeroRatio);
      
      const standardLabels = [];
      for (let i = 0; i < Y_AXIS_LABELS; i++) {
        const ratio = i / (Y_AXIS_LABELS - 1);
        const value = minValue + valueRange * (1 - ratio); 
        const y = PADDING_Y + chartAreaHeight * ratio;
        standardLabels.push({ value, y, isZero: false });
      }
      
      let zeroAdded = false;
      for (const label of standardLabels) {
        if (Math.abs(label.value) < valueRange * 0.05) {
          labels.push({ value: 0, y: zeroY, isZero: true });
          zeroAdded = true;
        } else {
          labels.push(label);
        }
      }
      
      if (!zeroAdded) {
        labels.push({ value: 0, y: zeroY, isZero: true });
      }
      
      labels.sort((a, b) => a.y - b.y);
    } else {
      for (let i = 0; i < Y_AXIS_LABELS; i++) {
        const ratio = i / (Y_AXIS_LABELS - 1);
        const value = minValue + valueRange * (1 - ratio); 
        const y = PADDING_Y + chartAreaHeight * ratio;
        labels.push({ value, y, isZero: false });
      }
    }
    
    return labels;
  }, [points, chartAreaHeight, isBinary]);

  const xAxisLabels = useMemo(() => {
    const labels = [];
    const { minTime, maxTime } = points;
    const timeRangeMs = maxTime - minTime || 1;
    
    for (let i = 0; i < X_AXIS_LABELS; i++) {
      const ratio = i / (X_AXIS_LABELS - 1);
      const time = minTime + timeRangeMs * ratio;
      const x = PADDING_X + chartAreaWidth * ratio;
      const date = new Date(time);
      
      const isLongRange = timeRangeMs > 24 * 60 * 60 * 1000;
      const label = isLongRange
        ? date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })
        : date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
      
      labels.push({ label, x, time });
    }
    return labels;
  }, [points, chartAreaWidth]);

  const levelRegions = useMemo(() => {
    if (!sensorType || !THRESHOLDS[sensorType] || (isBinary && sensorType !== 'smoke')) {
      return [];
    }
  
    const { low, normal, high } = THRESHOLDS[sensorType];
  
    let { minValue, maxValue } = points;
  
    const displayMin = Math.min(minValue, low, 0);
    const displayMax = Math.max(maxValue, high);
  
    const chartBottom = PADDING_Y + chartAreaHeight;
    const chartTop = PADDING_Y;                      
    const displayRange = (displayMax - displayMin) || 1;
  
    const getYForValue = (value) => {
      const ratio = (value - displayMin) / displayRange;
      const clamped = Math.max(0, Math.min(1, ratio));
      const y = chartBottom - chartAreaHeight * clamped;
      return Math.max(chartTop, Math.min(chartBottom, y));
    };
  

    const yMin    = getYForValue(displayMin);
    const yLow    = getYForValue(low);
    const yNormal = getYForValue(normal);
    const yHigh   = getYForValue(high);
    const yMax    = getYForValue(displayMax);

    const makeRegion = (level, topY, bottomY, color) => {
      const height = bottomY - topY;
      if (height <= 0) return null;
      return { level, y: topY, height, color };
    };
  
    const regionsRaw = [
      makeRegion('low',      yLow,    yMin,    LEVEL_COLORS.low),
      makeRegion('normal',   yNormal, yLow,    LEVEL_COLORS.normal),
      makeRegion('high',     yHigh,   yNormal, LEVEL_COLORS.high),
      makeRegion('veryHigh', yMax,    yHigh,   LEVEL_COLORS.veryHigh),
    ];
  
    const regions = regionsRaw.filter(Boolean);
    return regions;
  }, [sensorType, points, chartAreaHeight, isBinary, LEVEL_COLORS]);

  return (
    <View
      style={[styles.container, { width: chartWidth, height: chartHeight }]}
      {...panResponder.panHandlers}
    >
      <Svg width={chartWidth} height={chartHeight} viewBox={`0 0 ${chartWidth} ${chartHeight}`}>
        {levelRegions.map((region, idx) => (
          <G key={`region-${idx}-${region.level}`}>
            <Rect
              x={PADDING_X}
              y={region.y}
              width={chartAreaWidth}
              height={region.height}
              fill={region.color}
              opacity={0.35}
            />
            {/* Region label - centered in the region */}
            {region.height > 20 && (
              <SvgText
                x={PADDING_X + chartAreaWidth / 2}
                y={region.y + region.height / 2}
                fontSize="11"
                fill={colors.text || '#000000'}
                textAnchor="middle"
                fontWeight="600"
                opacity={0.8}
              >
                {region.level === 'low' ? t('sensors.legend.low', 'Thấp') :
                 region.level === 'normal' ? t('sensors.legend.normal', 'Bình thường') :
                 region.level === 'high' ? t('sensors.legend.high', 'Cao') :
                 t('sensors.legend.veryHigh', 'Rất cao')}
              </SvgText>
            )}
          </G>
        ))}

        {/* X axis line (horizontal line at y=0) */}
        {zeroLineInfo.hasZeroLine && (
          <Line
            x1={PADDING_X}
            y1={zeroLineInfo.zeroY}
            x2={PADDING_X + chartAreaWidth}
            y2={zeroLineInfo.zeroY}
            stroke={colors.text || '#000000'}
            strokeWidth={2}
            opacity={0.9}
          />
        )}

        {/* Y axis line (vertical line at x=PADDING_X) - always show */}
        <Line
          x1={PADDING_X}
          y1={PADDING_Y}
          x2={PADDING_X}
          y2={PADDING_Y + chartAreaHeight}
          stroke={colors.text || '#000000'}
          strokeWidth={2}
          opacity={0.9}
        />

        {yAxisLabels.map((item, idx) => (
          <G key={`y-${idx}`}>
            <Line
              x1={PADDING_X}
              y1={item.y}
              x2={PADDING_X + chartAreaWidth}
              y2={item.y}
              stroke={item.isZero ? (colors.text || '#000000') : (colors.border || '#E0E0E0')}
              strokeWidth={item.isZero ? 1.5 : 0.5}
              opacity={item.isZero ? 0.8 : 0.5}
            />
            {/* Y axis label */}
            <SvgText
              x={PADDING_X - 8}
              y={item.y + 4}
              fontSize="10"
              fill={item.isZero ? (colors.text || '#000000') : (colors.textSecondary || '#666')}
              textAnchor="end"
              fontWeight={item.isZero ? 'bold' : 'normal'}
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

        {isBinary && binaryRectangles.map((rect, idx) => (
          <G key={`rect-${idx}`}>
            <Path
              d={`M ${rect.x} ${rect.y} L ${rect.x + rect.width} ${rect.y} L ${rect.x + rect.width} ${rect.y + rect.height} L ${rect.x} ${rect.y + rect.height} Z`}
              fill={color || colors.primary}
              fillOpacity={0.2}
            />
          </G>
        ))}
        
        {/* Chart line */}
        <Path
          d={pathD}
          fill="none"
          stroke={color || colors.primary}
          strokeWidth={isBinary ? 2.5 : 2}
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
                fill={selectedPoint.isGapPoint ? (colors.textSecondary || '#666') : (color || colors.primary)}
                textAnchor="middle"
              >
                {selectedPoint.isGapPoint ? 'N/A' : selectedPoint.value.toFixed(1)}
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
