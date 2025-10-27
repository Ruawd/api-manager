import { Card, Space, Tag, Button, Typography, Tooltip, Divider } from 'antd'
import { 
  EyeOutlined, 
  ThunderboltOutlined, 
  BugOutlined, 
  ClockCircleOutlined, 
  EditOutlined, 
  DeleteOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
  PushpinFilled,
  GlobalOutlined,
  KeyOutlined,
  CopyOutlined,
  EyeInvisibleOutlined
} from '@ant-design/icons'

export default function MobileSiteCard({ 
  site, 
  onView, 
  onCheck, 
  onDebug, 
  onSetTime, 
  onEdit, 
  onDelete,
  onToggleApiKey,
  onCopyApiKey,
  isApiKeyVisible,
  scheduleConfig,
  isMobile = true
}) {
  const { billingLimit, billingUsage, billingError, unlimitedQuota } = site

  // 计算余额状态
  const getBillingStatus = () => {
    if (unlimitedQuota) {
      return { 
        type: 'unlimited', 
        color: '#ffd700', 
        text: '♾️ 无限额',
        detail: null
      }
    }
    if (billingError) {
      return { 
        type: 'error', 
        color: '#999', 
        text: '无法获取',
        detail: null
      }
    }
    if (typeof billingLimit === 'number' && typeof billingUsage === 'number') {
      const remaining = billingLimit - billingUsage
      const usedPercentage = (billingUsage / billingLimit) * 100
      const remainingPercentage = (remaining / billingLimit) * 100
      let color = '#52c41a'
      if (usedPercentage > 90) color = '#ff4d4f'
      else if (usedPercentage > 70) color = '#fa8c16'
      
      return { 
        type: usedPercentage > 90 ? 'danger' : usedPercentage > 70 ? 'warning' : 'success',
        color,
        text: `$${remaining.toFixed(2)}`,
        detail: {
          total: billingLimit.toFixed(2),
          used: billingUsage.toFixed(2),
          remaining: remaining.toFixed(2),
          percentage: remainingPercentage.toFixed(1)
        }
      }
    }
    return { type: 'none', color: '#d9d9d9', text: '-', detail: null }
  }

  const billingStatus = getBillingStatus()
  const displayApiKey = isApiKeyVisible 
    ? site.apiKey 
    : site.apiKey ? `${site.apiKey.slice(0, 8)}...${site.apiKey.slice(-4)}` : '-'
  
  // 解析cron表达式为可读时间
  const parseCron = (cronExpr) => {
    try {
      // 标准cron格式: 分 时 日 月 周
      const parts = cronExpr.trim().split(/\s+/)
      if (parts.length >= 2) {
        const minute = parts[0]
        const hour = parts[1]
        // 如果是数字，格式化为HH:MM
        if (!isNaN(minute) && !isNaN(hour)) {
          const h = String(hour).padStart(2, '0')
          const m = String(minute).padStart(2, '0')
          return `${h}:${m}`
        }
      }
      return cronExpr // 无法解析则返回原样
    } catch (e) {
      return cronExpr
    }
  }

  // 获取定时计划显示
  const getScheduleDisplay = () => {
    // 单独配置
    if (site.scheduleCron && site.scheduleCron.trim()) {
      return { text: parseCron(site.scheduleCron), color: 'blue', type: '单独' }
    }
    // 全局配置
    if (scheduleConfig?.enabled) {
      const h = String(scheduleConfig.hour).padStart(2, '0')
      const m = String(scheduleConfig.minute).padStart(2, '0')
      return { text: `${h}:${m}`, color: 'cyan', type: '全局' }
    }
    return { text: '未配置', color: 'default', type: null }
  }
  
  const scheduleDisplay = getScheduleDisplay()

  return (
    <Card
      hoverable
      style={{
        borderRadius: isMobile ? 12 : 14,
        marginBottom: 0,
        boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
        border: '1px solid rgba(0,0,0,0.06)',
        transition: 'all 0.3s ease',
        height: '100%'
      }}
      bodyStyle={{ padding: isMobile ? 12 : 14 }}
    >
      {/* 头部：名称和URL */}
      <Space size={4} wrap style={{ marginBottom: 4 }}>
        <Typography.Text strong style={{ fontSize: isMobile ? 14 : 15 }}>
          {site.name}
        </Typography.Text>
        {site.pinned && <PushpinFilled style={{ color: '#fa8c16', fontSize: 11 }} />}
      </Space>

      {/* URL */}
      <Typography.Link 
        href={site.baseUrl} 
        target="_blank"
        ellipsis
        style={{ fontSize: 11, color: '#999', display: 'block', marginBottom: 6 }}
      >
        <GlobalOutlined style={{ marginRight: 4, fontSize: 10 }} />
        {site.baseUrl}
      </Typography.Link>
        
      {/* 余额和标签信息并排布局 */}
      <div style={{ 
        display: 'flex', 
        gap: 8, 
        alignItems: 'flex-start',
        flexWrap: 'nowrap',
        marginBottom: 6
      }}>
          {/* 余额信息 */}
          {billingStatus.detail ? (
            <div style={{ 
              background: billingStatus.type === 'danger' ? '#fff2f0' :
                          billingStatus.type === 'warning' ? '#fff7e6' : '#f6ffed',
              border: `1px solid ${billingStatus.color}`,
              borderRadius: 6,
              padding: '6px 8px',
              fontSize: 10,
              flex: '0 0 auto',
              minWidth: 'fit-content'
            }}>
              <div style={{ display: 'flex', gap: '4px 12px', flexWrap: 'wrap', alignItems: 'baseline' }}>
                <span style={{ color: '#888', fontSize: 10, whiteSpace: 'nowrap' }}>
                  总额 <span style={{ fontWeight: 600, fontSize: 11, color: '#333' }}>${billingStatus.detail.total}</span>
                </span>
                <span style={{ color: '#888', fontSize: 10, whiteSpace: 'nowrap' }}>
                  已用 <span style={{ fontWeight: 600, fontSize: 11, color: '#333' }}>${billingStatus.detail.used}</span>
                </span>
              </div>
              <div style={{ marginTop: 4, display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <span style={{ color: '#888', fontSize: 10 }}>剩余</span>
                <span style={{ fontWeight: 700, color: billingStatus.color, fontSize: 14 }}>
                  ${billingStatus.detail.remaining}
                </span>
                <span style={{ color: billingStatus.color, fontSize: 10, fontWeight: 600 }}>
                  ({billingStatus.detail.percentage}%)
                </span>
              </div>
            </div>
          ) : (
            <Tag 
              color={billingStatus.color}
              style={{ 
                margin: 0,
                fontSize: 11,
                fontWeight: 600,
                padding: '3px 8px',
                borderRadius: 6,
                alignSelf: 'flex-start'
              }}
            >
              {billingStatus.text}
            </Tag>
          )}

          {/* 标签信息 */}
          <div style={{ 
            flex: '1 1 0', 
            minWidth: 0,
            display: 'flex', 
            flexWrap: 'wrap', 
            gap: 3, 
            alignItems: 'center',
            overflow: 'hidden'
          }}>
            <Tag color="blue" style={{ fontSize: 10, margin: 0, padding: '1px 6px' }}>
              {site.apiType === 'newapi' ? 'NewAPI' : 
               site.apiType === 'veloera' ? 'Veloera' :
               site.apiType === 'donehub' ? 'DoneHub' :
               site.apiType === 'voapi' ? 'VOAPI' : '其他'}
            </Tag>
            
            {site.enableCheckIn && (
              <Tag 
                color={site.checkInSuccess === true ? 'success' : 
                       site.checkInSuccess === false ? 'error' : 'warning'}
                style={{ fontSize: 10, margin: 0, padding: '1px 6px' }}
              >
                {site.checkInSuccess === true ? '✓' :
                 site.checkInSuccess === false ? '✗' : '○'}
                签到
              </Tag>
            )}
            
            {/* 定时计划 */}
            {scheduleDisplay.type && (
              <Tag color={scheduleDisplay.color} style={{ fontSize: 10, margin: 0, padding: '1px 6px' }}>
                ⏰ {scheduleDisplay.type} {scheduleDisplay.text}
              </Tag>
            )}
            
            {site.lastCheckedAt && (
              <Tag color="default" style={{ fontSize: 9, margin: 0, padding: '1px 6px' }}>
                {new Date(site.lastCheckedAt).toLocaleString('zh-CN', { 
                  month: '2-digit', 
                  day: '2-digit', 
                  hour: '2-digit', 
                  minute: '2-digit' 
                })}
              </Tag>
            )}
          </div>
      </div>

      {/* API密钥 */}
      {site.apiKey && (
        <div style={{ 
          background: '#f7f7f7', 
          padding: '5px 6px', 
          borderRadius: 6, 
          marginBottom: 6 
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography.Text 
              code 
              style={{ 
                fontSize: 10, 
                fontFamily: 'monospace',
                wordBreak: 'break-all',
                flex: 1,
                marginRight: 6
              }}
            >
              {displayApiKey}
            </Typography.Text>
            <Space size={2}>
              <Button
                type="text"
                size="small"
                icon={isApiKeyVisible ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                onClick={() => onToggleApiKey(site.id)}
                style={{ padding: '2px', height: 20, width: 20 }}
              />
              <Button
                type="text"
                size="small"
                icon={<CopyOutlined />}
                onClick={() => onCopyApiKey(site.apiKey)}
                style={{ padding: '2px', height: 20, width: 20 }}
              />
            </Space>
          </div>
        </div>
      )}

      <Divider style={{ margin: '6px 0' }} />

      {/* 操作按钮 */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: isMobile ? 'repeat(3, 1fr)' : 'repeat(6, 1fr)', 
        gap: isMobile ? 6 : 5 
      }}>
        <Button
          type="primary"
          icon={<EyeOutlined />}
          onClick={() => onView(site.id)}
          block
          size="small"
          style={{ fontSize: 11, padding: '4px 8px', height: 28 }}
        >
          {isMobile ? '详情' : '查看'}
        </Button>
        <Button
          icon={<ThunderboltOutlined />}
          onClick={() => onCheck(site.id)}
          block
          size="small"
          style={{ fontSize: 11, padding: '4px 8px', height: 28, color: '#52c41a', borderColor: '#52c41a' }}
        >
          检测
        </Button>
        <Button
          icon={<BugOutlined />}
          onClick={() => onDebug(site)}
          block
          size="small"
          style={{ fontSize: 11, padding: '4px 8px', height: 28, color: '#fa8c16', borderColor: '#fa8c16' }}
        >
          调试
        </Button>
        <Button
          icon={<ClockCircleOutlined />}
          onClick={() => onSetTime(site)}
          block
          size="small"
          style={{ fontSize: 11, padding: '4px 8px', height: 28 }}
        >
          定时
        </Button>
        <Button
          icon={<EditOutlined />}
          onClick={() => onEdit(site)}
          block
          size="small"
          style={{ fontSize: 11, padding: '4px 8px', height: 28, color: '#1890ff', borderColor: '#1890ff' }}
        >
          编辑
        </Button>
        <Button
          danger
          icon={<DeleteOutlined />}
          onClick={() => onDelete(site)}
          block
          size="small"
          style={{ fontSize: 11, padding: '4px 8px', height: 28 }}
        >
          删除
        </Button>
      </div>
    </Card>
  )
}

