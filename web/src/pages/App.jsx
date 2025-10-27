import { Layout, Menu, message, Modal, Dropdown } from 'antd'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { ApiOutlined, LogoutOutlined, AppstoreOutlined, DownloadOutlined, UploadOutlined } from '@ant-design/icons'
import { useState, useRef } from 'react'

export default function App() {
  const nav = useNavigate()
  const loc = useLocation()
  const fileInputRef = useRef(null)
  const [importing, setImporting] = useState(false)
  
  const logout = () => { localStorage.removeItem('token'); nav('/login') }
  
  const authHeaders = () => {
    const token = localStorage.getItem('token')
    return { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
  }
  
  // 导出站点
  const handleExport = async (format = 'default') => {
    try {
      const url = format === 'allapi' 
        ? '/api/exports/sites?format=allapi' 
        : '/api/exports/sites'
      
      const res = await fetch(url, {
        headers: authHeaders()
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || '导出失败')
      }
      const data = await res.json()
      
      // 创建下载
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const downloadUrl = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = downloadUrl
      const fileName = format === 'allapi'
        ? `accounts-backup-${new Date().toISOString().slice(0, 10)}.json`
        : `sites-export-${new Date().toISOString().slice(0, 10)}.json`
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(downloadUrl)
      
      const count = format === 'allapi' ? data.data?.accounts?.length : data.sites?.length
      message.success(`成功导出 ${count || 0} 个站点`)
    } catch (e) {
      message.error(e.message || '导出站点失败')
    }
  }
  
  // 导入站点
  const handleImport = () => {
    fileInputRef.current?.click()
  }
  
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    try {
      setImporting(true)
      const text = await file.text()
      const data = JSON.parse(text)
      
      // 检测文件格式并验证
      let sites = []
      let formatType = ''
      
      if (data.data && data.data.accounts && Array.isArray(data.data.accounts)) {
        // 新格式：accounts-backup格式
        sites = data.data.accounts
        formatType = 'accounts-backup'
        
        // 验证新格式必要字段
        const invalidSites = sites.filter(site => 
          !site.site_name || !site.site_url || !site.account_info?.access_token
        )
        if (invalidSites.length > 0) {
          throw new Error(`发现 ${invalidSites.length} 个无效的站点记录（缺少必要字段）`)
        }
      } else if (data.sites && Array.isArray(data.sites)) {
        // 原格式：标准导出格式
        sites = data.sites
        formatType = 'standard'
        
        // 验证原格式必要字段
        const invalidSites = sites.filter(site => 
          !site.name || !site.baseUrl || !site.apiKey
        )
        if (invalidSites.length > 0) {
          throw new Error(`发现 ${invalidSites.length} 个无效的站点记录（缺少必要字段）`)
        }
      } else {
        throw new Error('无效的导入文件格式，请选择正确的站点配置文件')
      }
      
      if (sites.length === 0) {
        throw new Error('文件中没有找到可导入的站点数据')
      }
      
      // 确认导入
      Modal.confirm({
        title: '确认导入站点',
        content: (
          <div>
            <p>将导入 <strong>{sites.length}</strong> 个站点</p>
            <p>文件格式: <strong>{formatType === 'accounts-backup' ? '账户备份格式' : '标准导出格式'}</strong></p>
            <p>是否继续？</p>
          </div>
        ),
        okText: '确认导入',
        cancelText: '取消',
        onOk: async () => {
          const res = await fetch('/api/sites/import', {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify(data)
          })
          
          if (!res.ok) {
            const errData = await res.json().catch(() => ({}))
            throw new Error(errData.error || '导入失败')
          }
          
          const result = await res.json()
          
          // 构建成功消息
          const parts = []
          if (result.imported > 0) parts.push(`新增 ${result.imported} 个`)
          if (result.updated > 0) parts.push(`更新 ${result.updated} 个`)
          const successMsg = parts.length > 0 ? `成功${parts.join('，')}站点` : '未导入任何站点'
          const formatMsg = result.format ? `（${result.format === 'accounts-backup' ? '账户备份格式' : '标准格式'}）` : ''
          message.success(successMsg + formatMsg)
          
          // 显示错误信息（如果有）
          if (result.errors && result.errors.length > 0) {
            console.warn('导入错误:', result.errors)
            message.warning(`部分站点导入失败，请查看控制台了解详情`)
          }
          
          // 刷新页面
          if (loc.pathname === '/') {
            window.location.reload()
          }
        }
      })
    } catch (e) {
      message.error(e.message || '导入站点失败')
    } finally {
      setImporting(false)
      e.target.value = '' // 重置文件输入
    }
  }
  
  return (
    <Layout style={{ minHeight: '100vh', background: 'var(--app-bg-gradient)' }}>
      <Layout.Header style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        background: 'rgba(255, 255, 255, 0.95)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        padding: '0 clamp(12px, 4vw, 32px)',
        height: 'auto',
        minHeight: '56px',
        flexWrap: 'wrap'
      }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 8,
          fontSize: 'clamp(16px, 4vw, 20px)',
          fontWeight: 700,
          background: 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          padding: '8px 0'
        }}>
          <ApiOutlined style={{ fontSize: 'clamp(20px, 5vw, 28px)', color: '#1890ff' }} />
          <span className="desktop-only">API管理系统</span>
          <span className="mobile-only" style={{ display: 'none' }}>API</span>
        </div>
        <Menu 
          mode="horizontal" 
          selectedKeys={[loc.pathname.startsWith('/sites') ? 'sites' : 'home']}
          style={{ 
            border: 'none',
            background: 'transparent',
            fontSize: 'clamp(13px, 3vw, 16px)',
            fontWeight: 500,
            flex: 1,
            justifyContent: 'flex-end'
          }}
          items={[
            {
              key: 'sites',
              icon: <AppstoreOutlined />,
              label: <span className="desktop-only">站点管理</span>,
              onClick: () => nav('/'),
              title: '站点管理'
            },
            {
              key: 'export',
              icon: <DownloadOutlined />,
              label: (
                <Dropdown
                  menu={{
                    items: [
                      {
                        key: 'default',
                        label: '导出（原始格式）',
                        onClick: () => handleExport('default')
                      },
                      {
                        key: 'allapi',
                        label: '导出（All-API-Hub格式）',
                        onClick: () => handleExport('allapi')
                      }
                    ]
                  }}
                  trigger={['click']}
                >
                  <span className="desktop-only" onClick={(e) => e.stopPropagation()}>
                    导出
                  </span>
                </Dropdown>
              ),
              title: '导出站点'
            },
            {
              key: 'import',
              icon: <UploadOutlined />,
              label: <span className="desktop-only">导入</span>,
              onClick: handleImport,
              disabled: importing,
              title: '导入站点'
            },
            {
              key: 'logout',
              icon: <LogoutOutlined />,
              label: <span className="desktop-only">退出</span>,
              onClick: logout,
              danger: true,
              title: '退出登录'
            }
          ]}
        />
      </Layout.Header>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
      <Layout.Content style={{ 
        padding: 'clamp(16px, 4vw, 32px) clamp(16px, 5vw, 48px)',
        maxWidth: 1400,
        width: '100%',
        margin: '0 auto'
      }}>
        <Outlet />
      </Layout.Content>
    </Layout>
  )
}
