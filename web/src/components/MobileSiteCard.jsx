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
      const percentage = (billingUsage / billingLimit) * 100
      let color = '#52c41a'
      if (percentage > 90) color = '#ff4d4f'
      else if (percentage > 70) color = '#fa8c16'
      
      return { 
        type: percentage > 90 ? 'danger' : percentage > 70 ? 'warning' : 'success',
        color,
        text: `$${remaining.toFixed(2)}`,
        detail: {
          total: billingLimit.toFixed(2),
          used: billingUsage.toFixed(2),
          remaining: remaining.toFixed(2),
          percentage: percentage.toFixed(1)
        }
      }
    }
    return { type: 'none', color: '#d9d9d9', text: '-', detail: null }
  }

  const billingStatus = getBillingStatus()
  const displayApiKey = isApiKeyVisible 
    ? site.apiKey 
    : site.apiKey ? `${site.apiKey.slice(0, 8)}...${site.apiKey.slice(-4)}` : '-'
  
  // 获取定时计划显示
  const getScheduleDisplay = () => {
    // 单独配置
    if (site.scheduleCron && site.scheduleCron.trim()) {
      return { text: site.scheduleCron, color: 'blue', type: '单独' }
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
        borderRadius: isMobile ? 14 : 16,
        marginBottom: isMobile ? 12 : 16,
        boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
        border: '1px solid rgba(0,0,0,0.06)',
        transition: 'all 0.3s ease'
      }}
      bodyStyle={{ padding: isMobile ? 14 : 18 }}
    >
      {/* 头部：名称和状态 */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
          <div style={{ flex: 1 }}>
            <Space size={4} wrap>
              <Typography.Text strong style={{ fontSize: isMobile ? 15 : 16 }}>
                {site.name}
              </Typography.Text>
              {site.pinned && <PushpinFilled style={{ color: '#fa8c16', fontSize: 12 }} />}
            </Space>
          </div>
        </div>

        {/* URL */}
        <Typography.Link 
          href={site.baseUrl} 
          target="_blank"
          ellipsis
          style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 8 }}
        >
          <GlobalOutlined style={{ marginRight: 4 }} />
          {site.baseUrl}
        </Typography.Link>
        
        {/* 余额信息 */}
        {billingStatus.detail ? (
          <div style={{ 
            background: billingStatus.type === 'danger' ? '#fff2f0' :
                        billingStatus.type === 'warning' ? '#fff7e6' : '#f6ffed',
            border: `1px solid ${billingStatus.color}`,
            borderRadius: 8,
            padding: 8,
            fontSize: 11
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ color: '#666' }}>总额：</span>
              <span style={{ fontWeight: 600 }}>${billingStatus.detail.total}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ color: '#666' }}>已用：</span>
              <span style={{ fontWeight: 600 }}>${billingStatus.detail.used}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#666' }}>剩余：</span>
              <span style={{ fontWeight: 700, color: billingStatus.color, fontSize: 13 }}>
                ${billingStatus.detail.remaining}
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
              padding: '4px 10px',
              borderRadius: 8
            }}
          >
            {billingStatus.text}
          </Tag>
        )}
      </div>

      {/* API密钥 */}
      {site.apiKey && (
        <div style={{ 
          background: '#f5f5f5', 
          padding: 8, 
          borderRadius: 8, 
          marginBottom: 12 
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography.Text 
              code 
              style={{ 
                fontSize: 11, 
                fontFamily: 'monospace',
                wordBreak: 'break-all',
                flex: 1,
                marginRight: 8
              }}
            >
              {displayApiKey}
            </Typography.Text>
            <Space size={4}>
              <Button
                type="text"
                size="small"
                icon={isApiKeyVisible ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                onClick={() => onToggleApiKey(site.id)}
                style={{ padding: '0 4px', height: 24 }}
              />
              <Button
                type="text"
                size="small"
                icon={<CopyOutlined />}
                onClick={() => onCopyApiKey(site.apiKey)}
                style={{ padding: '0 4px', height: 24 }}
              />
            </Space>
          </div>
        </div>
      )}

      {/* 标签信息 */}
      <Space size={4} wrap style={{ marginBottom: 12 }}>
        <Tag color="blue" style={{ fontSize: 11, margin: 0 }}>
          {site.apiType === 'newapi' ? 'NewAPI' : 
           site.apiType === 'veloera' ? 'Veloera' :
           site.apiType === 'donehub' ? 'DoneHub' :
           site.apiType === 'voapi' ? 'VOAPI' : '其他'}
        </Tag>
        
        {site.enableCheckIn && (
          <Tag 
            color={site.checkInSuccess === true ? 'success' : 
                   site.checkInSuccess === false ? 'error' : 'warning'}
            style={{ fontSize: 11, margin: 0 }}
          >
            {site.checkInSuccess === true ? <CheckCircleOutlined /> :
             site.checkInSuccess === false ? <CloseCircleOutlined /> :
             <ExclamationCircleOutlined />}
            {' '}签到
          </Tag>
        )}
        
        {/* 定时计划 */}
        {scheduleDisplay.type && (
          <Tag color={scheduleDisplay.color} style={{ fontSize: 11, margin: 0 }}>
            <ClockCircleOutlined /> {scheduleDisplay.type} {scheduleDisplay.text}
          </Tag>
        )}
        
        {site.lastCheckedAt && (
          <Tag color="default" style={{ fontSize: 10, margin: 0 }}>
            检测: {new Date(site.lastCheckedAt).toLocaleString('zh-CN', { 
              month: '2-digit', 
              day: '2-digit', 
              hour: '2-digit', 
              minute: '2-digit' 
            })}
          </Tag>
        )}
      </Space>

      <Divider style={{ margin: '12px 0' }} />

      {/* 操作按钮 */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: isMobile ? 'repeat(3, 1fr)' : 'repeat(6, 1fr)', 
        gap: 8 
      }}>
        <Button
          type="primary"
          icon={<EyeOutlined />}
          onClick={() => onView(site.id)}
          block
          size="small"
          style={{ fontSize: 12 }}
        >
          {isMobile ? '详情' : '查看'}
        </Button>
        <Button
          icon={<ThunderboltOutlined />}
          onClick={() => onCheck(site.id)}
          block
          size="small"
          style={{ fontSize: 12, color: '#52c41a', borderColor: '#52c41a' }}
        >
          检测
        </Button>
        <Button
          icon={<BugOutlined />}
          onClick={() => onDebug(site)}
          block
          size="small"
          style={{ fontSize: 12, color: '#fa8c16', borderColor: '#fa8c16' }}
        >
          调试
        </Button>
        <Button
          icon={<ClockCircleOutlined />}
          onClick={() => onSetTime(site)}
          block
          size="small"
          style={{ fontSize: 12 }}
        >
          定时
        </Button>
        <Button
          icon={<EditOutlined />}
          onClick={() => onEdit(site)}
          block
          size="small"
          style={{ fontSize: 12, color: '#1890ff', borderColor: '#1890ff' }}
        >
          编辑
        </Button>
        <Button
          danger
          icon={<DeleteOutlined />}
          onClick={() => onDelete(site)}
          block
          size="small"
          style={{ fontSize: 12 }}
        >
          删除
        </Button>
      </div>
    </Card>
  )
}

