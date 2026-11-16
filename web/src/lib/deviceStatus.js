// Keep the same readiness boundary as the scheduler: online alone isn't ready.
export function deviceStatus(device) {
  const status = device.effective_status || device.status || 'unknown'
  if (status === 'online' && device.extra?.readiness?.ready !== true) return { label: '未就绪', cls: 'warn' }
  return {
    online: { label: '空闲', cls: 'ok' },
    busy: { label: '占用中', cls: 'busy' },
    offline: { label: '离线', cls: 'off' },
    unauthorized: { label: '未授权', cls: 'warn' },
    locked: { label: '锁屏中', cls: 'warn' },
  }[status] || { label: status, cls: 'off' }
}

export function deviceReadinessHint(device) {
  const r = device.extra?.readiness
  if (deviceStatus(device).label !== '未就绪') return device.extra?.reason || ''
  return r?.hint || {
    wda_not_ready: 'WDA 未就绪', screen_locked: '请解锁屏幕',
    adb_offline: 'ADB 连接异常', hmdriver2_disconnected: '控制通道断开',
    driver_probe_failed: '设备探活失败',
  }[r?.not_ready_reason] || '等待设备探活'
}
