import { useState } from 'react'
import { Button, Card, Form, Input, Typography, message } from 'antd'
import { useNavigate, Link } from 'react-router-dom'
import { UserOutlined, LockOutlined, ApiOutlined, MailOutlined } from '@ant-design/icons'

export default function Register() {
  const [loading, setLoading] = useState(false)
  const nav = useNavigate()
  
  const onFinish = async (values) => {
    setLoading(true)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify(values)
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || '注册失败')
      }
      const data = await res.json()
      localStorage.setItem('token', data.token)
      message.success('注册成功，欢迎使用！')
      nav('/')
    } catch (e) {
      message.error(e.message || '注册失败，请重试')
    } finally { 
      setLoading(false) 
    }
  }

  return (
    <div style={{ 
      height: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      background: 'var(--app-bg-gradient)',
      padding: '20px'
    }}>
      <Card 
        style={{ 
          width: 460,
          borderRadius: 16,
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          overflow: 'hidden'
        }}
        bodyStyle={{ padding: 48 }}
      >
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <ApiOutlined style={{ 
            fontSize: 56, 
            color: '#1890ff',
            marginBottom: 16
          }} />
          <Typography.Title level={2} style={{ 
            marginBottom: 8,
            background: 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>
            注册账号
          </Typography.Title>
          <Typography.Text type="secondary" style={{ fontSize: 15 }}>
            创建新账号开始使用 API管理系统
          </Typography.Text>
        </div>
        
        <Form layout="vertical" onFinish={onFinish} size="large">
          <Form.Item 
            name="email" 
            label={<span style={{ fontSize: 15, fontWeight: 500 }}>邮箱地址</span>}
            rules={[
              { required: true, message: '请输入邮箱地址' },
              { type: 'email', message: '请输入有效的邮箱地址' }
            ]}
          >
            <Input 
              prefix={<MailOutlined style={{ color: '#bbb' }} />}
              placeholder="请输入邮箱" 
              style={{ borderRadius: 8, fontSize: 15 }}
            />
          </Form.Item>
          
          <Form.Item 
            name="password" 
            label={<span style={{ fontSize: 15, fontWeight: 500 }}>密码</span>}
            rules={[
              { required: true, message: '请输入密码' },
              { min: 6, message: '密码长度至少为6位' }
            ]}
          >
            <Input.Password 
              prefix={<LockOutlined style={{ color: '#bbb' }} />}
              placeholder="请输入密码（至少6位）" 
              style={{ borderRadius: 8, fontSize: 15 }}
            />
          </Form.Item>
          
          <Form.Item 
            name="confirmPassword" 
            label={<span style={{ fontSize: 15, fontWeight: 500 }}>确认密码</span>}
            dependencies={['password']}
            rules={[
              { required: true, message: '请确认密码' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) {
                    return Promise.resolve()
                  }
                  return Promise.reject(new Error('两次输入的密码不一致'))
                },
              }),
            ]}
          >
            <Input.Password 
              prefix={<LockOutlined style={{ color: '#bbb' }} />}
              placeholder="请再次输入密码" 
              style={{ borderRadius: 8, fontSize: 15 }}
            />
          </Form.Item>
          
          <Button 
            type="primary" 
            htmlType="submit" 
            block 
            loading={loading}
            style={{
              height: 48,
              borderRadius: 8,
              fontSize: 16,
              fontWeight: 600,
              marginTop: 12,
              background: 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)',
              border: 'none'
            }}
          >
            {loading ? '注册中...' : '注册账号'}
          </Button>
          
          <div style={{ 
            textAlign: 'center', 
            marginTop: 20,
            fontSize: 14
          }}>
            <Typography.Text type="secondary">
              已有账号？
            </Typography.Text>
            <Link 
              to="/login" 
              style={{ 
                marginLeft: 8,
                color: '#1890ff',
                fontWeight: 500
              }}
            >
              立即登录
            </Link>
          </div>
        </Form>
      </Card>
    </div>
  )
}

