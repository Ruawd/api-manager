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
  isApiKeyVisible 
}) {
  const { billingLimit, billingUsage, billingError, unlimitedQuota } = site

  // 计算余额状态
  const getBillingStatus = () => {
    if (unlimitedQuota) {
      return { type: 'unlimited', color: '#ffd700', text: '♾️ 无限额' }
    }
    if (billingError) {
      return { type: 'error', color: '#999', text: '无法获取' }
    }
    if (typeof billingLimit === 'number' && typeof billingUsage === 'number') {
      const remaining = billingLimit - billingUsage
      const percentage = (billingUsage / billingLimit) * 100
      if (percentage > 90) {
        return { type: 'danger', color: '#ff4d4f', text: `$${remaining.toFixed(2)}` }
      }
      if (percentage > 70) {
        return { type: 'warning', color: '#fa8c16', text: `$${remaining.toFixed(2)}` }
      }
      return { type: 'success', color: '#52c41a', text: `$${remaining.toFixed(2)}` }
    }
    return { type: 'none', color: '#d9d9d9', text: '-' }
  }

  const billingStatus = getBillingStatus()
  const displayApiKey = isApiKeyVisible 
    ? site.apiKey 
    : site.apiKey ? `${site.apiKey.slice(0, 8)}...${site.apiKey.slice(-4)}` : '-'

  return (
    <Card
      style={{
        borderRadius: 16,
        marginBottom: 12,
        boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
        border: '1px solid rgba(0,0,0,0.06)'
      }}
      bodyStyle={{ padding: 16 }}
    >
      {/* 头部：名称和状态 */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
          <div style={{ flex: 1 }}>
            <Space size={4} wrap>
              <Typography.Text strong style={{ fontSize: 16 }}>
                {site.name}
              </Typography.Text>
              {site.pinned && <PushpinFilled style={{ color: '#fa8c16', fontSize: 12 }} />}
            </Space>
          </div>
          {/* 余额状态 */}
          <Tag 
            color={billingStatus.color}
            style={{ 
              margin: 0,
              fontSize: 12,
              fontWeight: 600,
              padding: '2px 8px',
              borderRadius: 8
            }}
          >
            {billingStatus.text}
          </Tag>
        </div>

        {/* URL */}
        <Typography.Link 
          href={site.baseUrl} 
          target="_blank"
          ellipsis
          style={{ fontSize: 12, color: '#666' }}
        >
          <GlobalOutlined style={{ marginRight: 4 }} />
          {site.baseUrl}
        </Typography.Link>
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
        
        {site.lastCheckedAt && (
          <Tag color="default" style={{ fontSize: 10, margin: 0 }}>
            <ClockCircleOutlined /> {new Date(site.lastCheckedAt).toLocaleString('zh-CN', { 
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        <Button
          type="primary"
          icon={<EyeOutlined />}
          onClick={() => onView(site.id)}
          block
          size="small"
          style={{ fontSize: 12 }}
        >
          详情
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
          icon={<EditOutlined />}
          onClick={() => onEdit(site)}
          block
          size="small"
          style={{ fontSize: 12, color: '#1890ff', borderColor: '#1890ff' }}
        >
          编辑
        </Button>
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 8 }}>
        <Button
          icon={<BugOutlined />}
          onClick={() => onDebug(site)}
          block
          size="small"
          style={{ fontSize: 12, color: '#fa8c16', borderColor: '#fa8c16' }}
        >
          详情
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

