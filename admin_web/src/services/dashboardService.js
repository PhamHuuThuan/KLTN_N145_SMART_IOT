import devicesService from './devicesService';
import rulesService from './rulesService';

class DashboardService {
  // Get dashboard statistics
  async getStats() {
    try {
      // Fetch devices and rules in parallel
      const [devicesRes, rulesRes] = await Promise.allSettled([
        devicesService.getAllDevices({ limit: 1000 }),
        rulesService.getRulesStats()
      ]);

      const devices = devicesRes.status === 'fulfilled' ? (devicesRes.value?.data || []) : [];
      const rulesStats = rulesRes.status === 'fulfilled' ? (rulesRes.value?.data || {}) : {};

      // Count online devices
      const onlineDevices = devices.filter(d => {
        if (d.status === 'online') return true;
        if (d.status === 'offline') return false;
        if (d.lastSeenAt) {
          const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
          const lastSeen = new Date(d.lastSeenAt);
          return lastSeen > fiveMinutesAgo;
        }
        return false;
      }).length;

      // Count unique users from device ownerIds
      const uniqueUsers = new Set();
      devices.forEach(device => {
        if (device.ownerId) {
          uniqueUsers.add(device.ownerId);
        }
      });

      return {
        devices: {
          total: devices.length,
          online: onlineDevices,
          offline: devices.length - onlineDevices
        },
        rules: {
          total: rulesStats.total || 0,
          active: rulesStats.active || 0,
          inactive: rulesStats.inactive || 0
        },
        users: uniqueUsers.size
      };
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      throw error;
    }
  }
}

export default new DashboardService();
