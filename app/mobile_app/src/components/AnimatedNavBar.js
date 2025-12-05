import React, { useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, LayoutAnimation, Platform, UIManager } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const AnimatedNavBar = ({ 
  items, 
  selectedValue, 
  onSelect, 
  getItemKey,
  getItemLabel,
  getItemIcon,
  getItemColor,
  horizontal = true,
  style,
}) => {
  const { colors } = useTheme();
  // Initialize with opacity 0 to hide indicator until first layout
  const indicatorAnim = useRef(new Animated.Value(0)).current;
  const indicatorWidthAnim = useRef(new Animated.Value(80)).current;
  const indicatorOpacity = useRef(new Animated.Value(0)).current;
  const itemLayouts = useRef({});
  const containerRef = useRef(null);
  const scrollViewRef = useRef(null);

  const selectedIndex = useMemo(() => {
    if (!items || items.length === 0 || selectedValue === null || selectedValue === undefined) {
      return -1;
    }
    
    const index = items.findIndex((item, idx) => {
      if (!item) return false;
      try {
        const key = getItemKey ? getItemKey(item, idx) : (item?.key || item?.value || idx);
        const matches = key === selectedValue || String(key) === String(selectedValue) || item === selectedValue;
        return matches;
      } catch (e) {
        return false;
      }
    });
    
    return index;
  }, [items, selectedValue, getItemKey]);

  useEffect(() => {
    if (selectedIndex < 0 || !items || items.length === 0) {
      Animated.parallel([
        Animated.timing(indicatorAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: false,
        }),
        Animated.timing(indicatorWidthAnim, {
          toValue: 80,
          duration: 200,
          useNativeDriver: false,
        }),
        Animated.timing(indicatorOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: false,
        }),
      ]).start();
      return;
    }

    const layout = itemLayouts.current[selectedIndex];
    if (!layout) {
      // Wait a bit for layout to be measured - try multiple times
      let attempts = 0;
      const maxAttempts = 5;
      const checkLayout = () => {
        attempts++;
        const retryLayout = itemLayouts.current[selectedIndex];
        if (retryLayout) {
          const { x, y, width, height } = retryLayout;
          Animated.parallel([
            Animated.spring(indicatorAnim, {
              toValue: horizontal ? x : y,
              useNativeDriver: false,
              tension: 68,
              friction: 8,
            }),
            Animated.spring(indicatorWidthAnim, {
              toValue: horizontal ? width : height,
              useNativeDriver: false,
              tension: 68,
              friction: 8,
            }),
            Animated.timing(indicatorOpacity, {
              toValue: 1,
              duration: 300,
              useNativeDriver: false,
            }),
          ]).start();
          
          // Auto scroll to selected item
          if (scrollViewRef.current && horizontal) {
            const screenWidth = require('react-native').Dimensions.get('window').width;
            const scrollX = Math.max(0, x - screenWidth / 2 + width / 2);
            scrollViewRef.current.scrollTo({ x: scrollX, animated: true });
          }
        } else if (attempts < maxAttempts) {
          setTimeout(checkLayout, 50);
        }
      };
      const timer = setTimeout(checkLayout, 50);
      return () => clearTimeout(timer);
    }

    const { x, y, width, height } = layout;
    
    // Animate position with smooth spring animation and fade in
    Animated.parallel([
      Animated.spring(indicatorAnim, {
        toValue: horizontal ? x : y,
        useNativeDriver: false,
        tension: 68,
        friction: 8,
      }),
      Animated.spring(indicatorWidthAnim, {
        toValue: horizontal ? width : height,
        useNativeDriver: false,
        tension: 68,
        friction: 8,
      }),
      Animated.timing(indicatorOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: false,
      }),
    ]).start();

    // Auto scroll to selected item
    if (scrollViewRef.current && horizontal) {
      const screenWidth = require('react-native').Dimensions.get('window').width;
      const scrollX = Math.max(0, x - screenWidth / 2 + width / 2);
      scrollViewRef.current.scrollTo({ x: scrollX, animated: true });
    }
  }, [selectedIndex, horizontal, indicatorAnim, indicatorWidthAnim, indicatorOpacity, items]);

  const handleSelect = (item, index) => {
    if (!item) {
      return;
    }
    
    LayoutAnimation.configureNext({
      duration: 200,
      create: {
        type: LayoutAnimation.Types.easeInEaseOut,
        property: LayoutAnimation.Properties.opacity,
      },
      update: {
        type: LayoutAnimation.Types.spring,
        springDamping: 0.7,
      },
    });
    
    try {
      const key = getItemKey ? getItemKey(item, index) : (item?.key || item?.value || index);
      onSelect(key, item, index);
    } catch (e) {
      // Silently handle error
    }
  };

  const handleItemLayout = (index, event) => {
    try {
      const { x, y, width, height } = event.nativeEvent.layout;
      itemLayouts.current[index] = { x, y, width, height };
      
      if (index === selectedIndex && selectedIndex >= 0) {
        Animated.parallel([
          Animated.spring(indicatorAnim, {
            toValue: horizontal ? x : y,
            useNativeDriver: false,
            tension: 68,
            friction: 8,
          }),
          Animated.spring(indicatorWidthAnim, {
            toValue: horizontal ? width : height,
            useNativeDriver: false,
            tension: 68,
            friction: 8,
          }),
          Animated.timing(indicatorOpacity, {
            toValue: 1,
            duration: 300,
            useNativeDriver: false,
          }),
        ]).start();
      }
    } catch (e) {
      // Silently handle error
    }
  };

  const renderItem = (item, index) => {
    if (!item) return null;
    
    const key = getItemKey ? getItemKey(item, index) : (item?.key || item?.value || index);
    const isSelected = selectedIndex === index;
    
    let label = '';
    try {
      label = getItemLabel ? getItemLabel(item, index) : (item?.label || item?.name || String(item || ''));
    } catch (e) {
      label = String(item || '');
    }
    
    let icon = null;
    try {
      icon = getItemIcon ? getItemIcon(item, index) : item?.icon;
    } catch (e) {
      icon = null;
    }
    
    let itemColor = colors.primary;
    try {
      itemColor = getItemColor ? getItemColor(item, index) : (item?.color || colors.primary);
    } catch (e) {
      itemColor = colors.primary;
    }
    
    const textColor = isSelected ? colors.white : colors.textSecondary;

    return (
      <TouchableOpacity
        key={key}
        style={[
          styles.item,
          horizontal ? styles.itemHorizontal : styles.itemVertical,
        ]}
        onPress={() => handleSelect(item, index)}
        onLayout={(event) => handleItemLayout(index, event)}
        activeOpacity={0.7}
      >
        <View
          style={[
            styles.itemContent,
            {
              opacity: isSelected ? 1 : 0.8,
            },
          ]}
        >
          {icon && (
            <MaterialCommunityIcons
              name={icon}
              size={18}
              color={textColor}
              style={styles.itemIcon}
            />
          )}
          <Text
            style={[
              styles.itemText,
              { color: textColor },
              isSelected && styles.itemTextSelected,
            ]}
            numberOfLines={1}
          >
            {label}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const indicatorHeight = horizontal ? 32 : 40;

  return (
    <View
      ref={containerRef}
      style={[
        styles.container,
        horizontal ? styles.containerHorizontal : styles.containerVertical,
        { backgroundColor: colors.surface, borderColor: colors.border },
        style,
      ]}
    >
      <View style={styles.scrollWrapper}>
        <Animated.ScrollView
          ref={scrollViewRef}
          horizontal={horizontal}
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scrollContent,
            horizontal ? styles.scrollContentHorizontal : styles.scrollContentVertical,
            { position: 'relative' },
          ]}
        >
          {/* Animated indicator background - positioned inside scroll content */}
          {selectedIndex >= 0 && (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.indicator,
                horizontal
                  ? {
                      position: 'absolute',
                      left: indicatorAnim,
                      width: indicatorWidthAnim,
                      height: indicatorHeight,
                      top: 4,
                    }
                  : {
                      position: 'absolute',
                      top: indicatorAnim,
                      width: '100%',
                      height: indicatorWidthAnim,
                      left: 4,
                    },
                {
                  backgroundColor: (selectedIndex >= 0 && items[selectedIndex])
                    ? (() => {
                        try {
                          return getItemColor
                            ? getItemColor(items[selectedIndex], selectedIndex)
                            : (items[selectedIndex]?.color || colors.primary);
                        } catch (e) {
                          return colors.primary;
                        }
                      })()
                    : colors.primary,
                  borderRadius: 16,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.15,
                  shadowRadius: 4,
                  elevation: 3,
                  opacity: indicatorOpacity,
                },
              ]}
            />
          )}
          
          {/* Items */}
          {items && items.length > 0
            ? items.map((item, index) => renderItem(item, index))
            : null}
        </Animated.ScrollView>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 20,
    padding: 4,
    borderWidth: 1,
    overflow: 'hidden',
  },
  containerHorizontal: {
    flexDirection: 'row',
  },
  containerVertical: {
    flexDirection: 'column',
  },
  scrollWrapper: {
    position: 'relative',
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  scrollContentHorizontal: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scrollContentVertical: {
    flexDirection: 'column',
  },
  indicator: {
    zIndex: 0,
  },
  item: {
    zIndex: 1,
    marginHorizontal: 1,
    marginVertical: 2,
  },
  itemHorizontal: {
    paddingHorizontal: 2,
  },
  itemVertical: {
    width: '100%',
    marginHorizontal: 0,
  },
  itemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    minHeight: 32,
    minWidth: 70,
  },
  itemIcon: {
    marginRight: 6,
  },
  itemText: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
  itemTextSelected: {
    fontWeight: '600',
  },
});

export default AnimatedNavBar;

