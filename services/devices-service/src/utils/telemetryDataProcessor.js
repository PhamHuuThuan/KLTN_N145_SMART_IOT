export const SENSOR_FIELD_MAP = {
  temperature: 'temp',
  humidity: 'humid',
  gas: 'gas_ppm',
  smoke: 'smoke'
};

export function normalizeTelemetryLogs(logs, sensorField = null) {
  return logs
    .map(log => {
      const timestamp = log.createdAt || new Date(log.payload?.ts || Date.now());
      
      if (sensorField) {
        const value = log.payload?.[sensorField];
        if (value === null || value === undefined || isNaN(Number(value))) {
          return null;
        }
        
        return {
          createdAt: timestamp,
          payload: {
            ts: log.payload?.ts || timestamp.getTime(),
            [sensorField]: Number(value)
          }
        };
      } else {
        return {
          createdAt: timestamp,
          payload: {
            ts: log.payload?.ts || timestamp.getTime(),
            temp: log.payload?.temp ?? 0,
            humid: log.payload?.humid ?? 0,
            smoke: log.payload?.smoke ?? 0,
            gas_ppm: log.payload?.gas_ppm ?? 0,
          }
        };
      }
    })
    .filter(log => log !== null);
}

export function smartDownsample(logs, maxRecords, sensorField = null) {
  if (logs.length <= maxRecords) {
    return logs;
  }
  
  if (logs.length === 0) {
    return logs;
  }
  
  const firstPoint = logs[0];
  const lastPoint = logs[logs.length - 1];
  
  const startTime = new Date(firstPoint.createdAt).getTime();
  const endTime = new Date(lastPoint.createdAt).getTime();
  const timeRange = endTime - startTime;
  
  if (timeRange === 0) {
    const step = Math.ceil(logs.length / maxRecords);
    const sampled = [];
    for (let i = 0; i < logs.length; i += step) {
      sampled.push(logs[i]);
    }
    if (sampled[sampled.length - 1] !== lastPoint) {
      sampled.push(lastPoint);
    }
    return sampled;
  }
  
  const reservedSlots = Math.max(100, Math.floor(maxRecords * 0.2));
  const availableSlots = maxRecords - reservedSlots;
  const numBuckets = Math.max(10, Math.floor(availableSlots / 2));
  
  const bucketSize = timeRange / numBuckets;
  
  const buckets = Array(numBuckets).fill(null).map(() => []);
  
  for (const log of logs) {
    const logTime = new Date(log.createdAt).getTime();
    const bucketIndex = Math.min(
      Math.floor((logTime - startTime) / bucketSize),
      numBuckets - 1
    );
    buckets[bucketIndex].push(log);
  }
  
  const getValue = (log) => {
    if (!sensorField) return null;
    const value = log.payload?.[sensorField];
    return value !== null && value !== undefined ? Number(value) : null;
  };
  
  if (!sensorField) {
    const step = Math.ceil(logs.length / maxRecords);
    const sampled = [];
    for (let i = 0; i < logs.length; i += step) {
      sampled.push(logs[i]);
    }
    if (sampled[sampled.length - 1] !== lastPoint) {
      sampled.push(lastPoint);
    }
    return sampled;
  }
  
  const sampled = [];
  
  sampled.push(firstPoint);
  
  const maxPointsPerBucket = Math.max(2, Math.floor((maxRecords - 2) / numBuckets));
  
  for (let i = 0; i < buckets.length; i++) {
    const bucket = buckets[i];
    if (bucket.length === 0) continue;
    
    if (bucket.length === 1) {
      if (bucket[0] !== firstPoint && bucket[0] !== lastPoint) {
        sampled.push(bucket[0]);
      }
    } else {
      let minPoint = bucket[0];
      let maxPoint = bucket[0];
      let minValue = getValue(bucket[0]);
      let maxValue = getValue(bucket[0]);
      
      for (const point of bucket) {
        const value = getValue(point);
        if (value !== null && value !== undefined) {
          if (minValue === null || value < minValue) {
            minValue = value;
            minPoint = point;
          }
          if (maxValue === null || value > maxValue) {
            maxValue = value;
            maxPoint = point;
          }
        }
      }
      
      const pointsToAdd = [];
      
      if (minPoint !== firstPoint && minPoint !== lastPoint) {
        pointsToAdd.push(minPoint);
      }
      if (maxPoint !== firstPoint && maxPoint !== lastPoint && maxPoint !== minPoint) {
        pointsToAdd.push(maxPoint);
      }
      
      if (bucket.length > 5 && minValue !== null && maxValue !== null && minValue !== maxValue) {
        const mean = (minValue + maxValue) / 2;
        const range = Math.abs(maxValue - minValue);
        const threshold = range * 0.25;
        
        const outliers = [];
        for (const point of bucket) {
          const value = getValue(point);
          if (value !== null && value !== undefined) {
            const deviation = Math.abs(value - mean);
            if (deviation > threshold && point !== firstPoint && point !== lastPoint) {
              if (point !== minPoint && point !== maxPoint) {
                outliers.push({ point, deviation });
              }
            }
          }
        }
        
        outliers.sort((a, b) => b.deviation - a.deviation);
        
        const remainingSlots = maxPointsPerBucket - pointsToAdd.length;
        for (let j = 0; j < Math.min(remainingSlots, outliers.length); j++) {
          pointsToAdd.push(outliers[j].point);
        }
      }
      
      if (pointsToAdd.length < maxPointsPerBucket && bucket.length > pointsToAdd.length) {
        const remainingSlots = maxPointsPerBucket - pointsToAdd.length;
        const step = Math.max(1, Math.floor(bucket.length / (remainingSlots + 1)));
        
        const addedSet = new Set(pointsToAdd);
        for (let j = 0; j < bucket.length && pointsToAdd.length < maxPointsPerBucket; j += step) {
          const point = bucket[j];
          if (point !== firstPoint && point !== lastPoint && !addedSet.has(point)) {
            pointsToAdd.push(point);
            addedSet.add(point);
          }
        }
      }
      
      pointsToAdd.sort((a, b) => {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });
      sampled.push(...pointsToAdd);
    }
  }
  
  if (sampled[sampled.length - 1] !== lastPoint) {
    sampled.push(lastPoint);
  }
  
  sampled.sort((a, b) => {
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
  
  if (sampled.length > maxRecords) {
    const step = Math.ceil(sampled.length / maxRecords);
    const finalSampled = [];
    for (let i = 0; i < sampled.length; i += step) {
      finalSampled.push(sampled[i]);
    }
    if (finalSampled[finalSampled.length - 1] !== lastPoint) {
      finalSampled.push(lastPoint);
    }
    return finalSampled;
  }
  
  return sampled;
}

