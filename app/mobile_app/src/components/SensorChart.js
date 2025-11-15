import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Svg, { Path, Line, Circle, G, Text as SvgText } from 'react-native-svg';
import { useTheme } from '../contexts/ThemeContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_WIDTH = SCREEN_WIDTH - 60; // Padding and margins
const CHART_HEIGHT = 250;
const PADDING_X = 40;
const PADDING_Y = 40;
const CHART_AREA_WIDTH = CHART_WIDTH - PADDING_X * 2;
const CHART_AREA_HEIGHT = CHART_HEIGHT - PADDING_Y * 2;

const SensorChart = ({ data, color, unit, height = CHART_HEIGHT }) => {
  const { colors } = useTheme();
  
  if (!data || !data.labels || !data.values || data.values.length === 0) {
    return null;
  }

  const values = data.values;
  const labels = data.labels;
  const timestamps = data.timestamps || [];
  
  // Calculate min/max for scaling
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const valueRange = maxValue - minValue || 1; // Avoid division by zero
  
  // Calculate Y-axis scale
  const yAxisSteps = 5;
  const yAxisValues = [];
  for (let i = 0; i <= yAxisSteps; i++) {
    yAxisValues.push(minValue + (valueRange * i) / yAxisSteps);
  }

  // Generate path for line chart
  const points = values.map((value, index) => {
    const x = PADDING_X + (CHART_AREA_WIDTH * index) / (values.length - 1 || 1);
    const y = PADDING_Y + CHART_AREA_HEIGHT - ((value - minValue) / valueRange) * CHART_AREA_HEIGHT;
    return { x, y, value };
  });

  // Create smooth path using line segments
  const createSmoothPath = (points) => {
    if (points.length < 2) return '';
    
    let path = `M ${points[0].x} ${points[0].y}`;
    
    // Simple line path for better performance
    for (let i = 1; i < points.length; i++) {
      path += ` L ${points[i].x} ${points[i].y}`;
    }
    
    return path;
  };

  const linePath = createSmoothPath(points);

  // Area path (fill under line)
  const areaPath = linePath + 
    ` L ${points[points.length - 1].x} ${PADDING_Y + CHART_AREA_HEIGHT}` +
    ` L ${points[0].x} ${PADDING_Y + CHART_AREA_HEIGHT} Z`;

  // Format value for display
  const formatValue = (value) => {
    if (value >= 1000) {
      return (value / 1000).toFixed(1) + 'k';
    }
    return value.toFixed(value % 1 === 0 ? 0 : 1);
  };

  // Show labels for every nth point
  const labelStep = Math.max(1, Math.floor(labels.length / 6));

  return (
    <View style={styles.container}>
      <Svg width={CHART_WIDTH} height={height} viewBox={`0 0 ${CHART_WIDTH} ${height}`}>
        {/* Grid lines */}
        <G stroke={colors.border} strokeWidth="1" opacity="0.3">
          {yAxisValues.map((_, index) => {
            const y = PADDING_Y + (CHART_AREA_HEIGHT * index) / yAxisSteps;
            return (
              <Line
                key={`grid-${index}`}
                x1={PADDING_X}
                y1={y}
                x2={PADDING_X + CHART_AREA_WIDTH}
                y2={y}
                strokeDasharray="4,4"
              />
            );
          })}
        </G>

        {/* Y-axis labels */}
        <G fill={colors.textSecondary} fontSize="10" textAnchor="end">
          {yAxisValues.map((value, index) => {
            const y = PADDING_Y + (CHART_AREA_HEIGHT * index) / yAxisSteps;
            return (
              <SvgText
                key={`y-label-${index}`}
                x={PADDING_X - 8}
                y={y + 4}
                fill={colors.textSecondary}
              >
                {formatValue(value)}
              </SvgText>
            );
          })}
        </G>

        {/* X-axis labels */}
        <G fill={colors.textSecondary} fontSize="10" textAnchor="middle">
          {labels.map((label, index) => {
            if (index % labelStep !== 0 && index !== labels.length - 1) return null;
            const x = PADDING_X + (CHART_AREA_WIDTH * index) / (labels.length - 1 || 1);
            return (
              <SvgText
                key={`x-label-${index}`}
                x={x}
                y={height - 8}
                fill={colors.textSecondary}
              >
                {label}
              </SvgText>
            );
          })}
        </G>

        {/* Area under line */}
        <Path
          d={areaPath}
          fill={color}
          opacity="0.2"
        />

        {/* Line */}
        <Path
          d={linePath}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Data points */}
        {points.map((point, index) => (
          <Circle
            key={`point-${index}`}
            cx={point.x}
            cy={point.y}
            r="4"
            fill={color}
            stroke={colors.surface}
            strokeWidth="2"
          />
        ))}
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default SensorChart;

