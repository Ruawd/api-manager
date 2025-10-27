import { useEffect, useState, useMemo, useCallback, memo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Card, Collapse, List, Space, Tag, Typography, message, Button, Row, Col, Statistic, Empty, Modal, Form, Input, Switch, Select, Table, Popconfirm, InputNumber, DatePicker, Drawer } from 'antd'
import { useIsMobile } from '../hooks/useIsMobile'
import { 
  ThunderboltOutlined, 
  PlusCircleOutlined, 
  MinusCircleOutlined,
  ClockCircleOutlined,
  ApiOutlined,
  ArrowLeftOutlined,
  CopyOutlined,
  UpOutlined,
  DownOutlined,
  KeyOutlined,
  EditOutlined,
  DeleteOutlined,
  GiftOutlined,
  EyeOutlined,
  EyeInvisibleOutlined
} from '@ant-design/icons'
import dayjs from 'dayjs'

function authHeaders(includeJson = false) {
  const t = localStorage.getItem('token');
  const h = { 'Authorization': `Bearer ${t}` };
  if (includeJson) h['Content-Type'] = 'application/json';
  return h;
}

// 提取模型提供者
function getModelProvider(modelId) {
  const id = modelId.toLowerCase()
  if (id.includes('gpt') || id.includes('o1') || id.includes('o3') || id.includes('chatgpt')) return 'OpenAI'
  if (id.includes('claude')) return 'Claude'
  if (id.includes('qwen')) return 'Qwen'
  if (id.includes('gemini')) return 'Gemini'
  if (id.includes('deepseek')) return 'DeepSeek'
  if (id.includes('zhipu') || id.includes('glm')) return 'ZhipuAI'
  if (id.includes('yi-') || id.includes('01-ai')) return '01.AI'
  if (id.includes('mistral')) return 'Mistral'
  if (id.includes('llama')) return 'Meta'
  if (id.includes('moonshot')) return 'Moonshot'
  return '其他'
}

// 获取提供者图标组件
function getProviderIcon(provider, size = 16) {
  const style = { 
    width: size, 
    height: size, 
    borderRadius: '50%',
    objectFit: 'cover'
  }
  
  const iconMap = {
    'OpenAI': <span style={{ 
      display: 'inline-flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      width: size, 
      height: size, 
      borderRadius: '50%',
      background: '#10a37f',
      color: 'white',
      fontWeight: 'bold',
      fontSize: size * 0.6
    }}>O</span>,
    'Claude': <span style={{ 
      display: 'inline-flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      width: size, 
      height: size, 
      borderRadius: '50%',
      background: '#CC9B7A',
      color: 'white',
      fontWeight: 'bold',
      fontSize: size * 0.6
    }}>C</span>,
    'Qwen': <span style={{ 
      display: 'inline-flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      width: size, 
      height: size, 
      borderRadius: '50%',
      background: '#6366f1',
      color: 'white',
      fontWeight: 'bold',
      fontSize: size * 0.5
    }}>通义</span>,
    'Gemini': <span style={{ 
      display: 'inline-flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      width: size, 
      height: size, 
      borderRadius: '50%',
      background: '#4285f4',
      color: 'white',
      fontWeight: 'bold',
      fontSize: size * 0.6
    }}>G</span>,
    'DeepSeek': <span style={{ 
      display: 'inline-flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      width: size, 
      height: size, 
      borderRadius: '50%',
      background: '#1a1a1a',
      color: 'white',
      fontWeight: 'bold',
      fontSize: size * 0.6
    }}>DS</span>,
    'ZhipuAI': <span style={{ 
      display: 'inline-flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      width: size, 
      height: size, 
      borderRadius: '50%',
      background: '#2563eb',
      color: 'white',
      fontWeight: 'bold',
      fontSize: size * 0.6
    }}>Z</span>,
    '01.AI': <span style={{ 
      display: 'inline-flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      width: size, 
      height: size, 
      borderRadius: '50%',
      background: '#8b5cf6',
      color: 'white',
      fontWeight: 'bold',
      fontSize: size * 0.6
    }}>Y</span>,
    'Mistral': <span style={{ 
      display: 'inline-flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      width: size, 
      height: size, 
      borderRadius: '50%',
      background: '#f97316',
      color: 'white',
      fontWeight: 'bold',
      fontSize: size * 0.6
    }}>M</span>,
    'Meta': <span style={{ 
      display: 'inline-flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      width: size, 
      height: size, 
      borderRadius: '50%',
      background: '#0668E1',
      color: 'white',
      fontWeight: 'bold',
      fontSize: size * 0.6
    }}>M</span>,
    'Moonshot': <span style={{ 
      display: 'inline-flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      width: size, 
      height: size, 
      borderRadius: '50%',
      background: '#7c3aed',
      color: 'white',
      fontWeight: 'bold',
      fontSize: size * 0.5
    }}>月</span>,
    '其他': <span style={{ 
      display: 'inline-flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      width: size, 
      height: size, 
      borderRadius: '50%',
      background: '#94a3b8',
      color: 'white',
      fontWeight: 'bold',
      fontSize: size * 0.6
    }}>?</span>
  }
  return iconMap[provider] || iconMap['其他']
}

export default function SiteDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const isMobile = useIsMobile(768)
  const [diffs, setDiffs] = useState([])
  const [snapshot, setSnapshot] = useState([])
  const [loading, setLoading] = useState(false)
  const [modelsExpanded, setModelsExpanded] = useState(true)
  const [modelSearchText, setModelSearchText] = useState('')
  const [selectedProvider, setSelectedProvider] = useState('all')
  const [selectedGroup, setSelectedGroup] = useState('all')
  const [showRealPrice, setShowRealPrice] = useState(false)
  const [showMultiplier, setShowMultiplier] = useState(true)
  const [showEndpoint, setShowEndpoint] = useState(true)
  const [modelPricing, setModelPricing] = useState({})
  
  // 令牌管理相关状态
  const [tokenModalVisible, setTokenModalVisible] = useState(false)
  const [tokens, setTokens] = useState([])
  const [tokenLoading, setTokenLoading] = useState(false)
  const [editModalVisible, setEditModalVisible] = useState(false)
  const [editingToken, setEditingToken] = useState(null)
  const [createModalVisible, setCreateModalVisible] = useState(false)
  const [groups, setGroups] = useState([])
  const [form] = Form.useForm()
  const [createForm] = Form.useForm()
  
  // 兑换码相关状态
  const [redeemModalVisible, setRedeemModalVisible] = useState(false)
  const [redeemCodes, setRedeemCodes] = useState('')
  const [redeemLoading, setRedeemLoading] = useState(false)
  const [redeemResults, setRedeemResults] = useState([])
  
  // 子站点相关状态
  const [subSites, setSubSites] = useState([])
  const [subSiteModalVisible, setSubSiteModalVisible] = useState(false)
  const [subSiteForm] = Form.useForm()
  const [editingSubSite, setEditingSubSite] = useState(null)

  const copyToClipboard = useCallback((text, successMsg = '复制成功') => {
    navigator.clipboard.writeText(text).then(() => {
      message.success(successMsg)
    }).catch(() => {
      message.error('复制失败，请手动复制')
    })
  }, [])

  const copyAllModels = useCallback((models) => {
    if (!models || models.length === 0) {
      message.warning('没有可复制的模型')
      return
    }
    const names = models.map(m => m.id).join(',')
    copyToClipboard(names, `已复制 ${models.length} 个模型名称`)
  }, [copyToClipboard])
  
  // 筛选和分组模型
  const filteredAndGroupedModels = useMemo(() => {
    let filtered = snapshot
    
    // 搜索筛选
    if (modelSearchText) {
      filtered = filtered.filter(m => 
        m.id.toLowerCase().includes(modelSearchText.toLowerCase())
      )
    }
    
    // 提供者筛选
    if (selectedProvider !== 'all') {
      filtered = filtered.filter(m => 
        getModelProvider(m.id) === selectedProvider
      )
    }
    
    // 用户分组筛选
    if (selectedGroup !== 'all') {
      filtered = filtered.filter(m => {
        const pricing = modelPricing[m.id]
        if (!pricing || !pricing.groups) return false
        return pricing.groups.includes(selectedGroup)
      })
    }
    
    // 按提供者分组
    const grouped = {}
    filtered.forEach(model => {
      const provider = getModelProvider(model.id)
      if (!grouped[provider]) {
        grouped[provider] = []
      }
      grouped[provider].push(model)
    })
    
    return { filtered, grouped }
  }, [snapshot, modelSearchText, selectedProvider, selectedGroup, modelPricing])
  
  // 获取所有提供者及数量
  const providers = useMemo(() => {
    const providerCount = {}
    snapshot.forEach(model => {
      const provider = getModelProvider(model.id)
      providerCount[provider] = (providerCount[provider] || 0) + 1
    })
    return Object.entries(providerCount).sort((a, b) => b[1] - a[1])
  }, [snapshot])
  
  // 从pricing数据中提取所有用户分组
  const availableGroups = useMemo(() => {
    const groupSet = new Set()
    Object.values(modelPricing).forEach(pricing => {
      if (pricing.groups && Array.isArray(pricing.groups)) {
        pricing.groups.forEach(g => groupSet.add(g))
      }
    })
    // 转换为Select需要的格式
    return Array.from(groupSet).map(g => ({
      value: g,
      label: g || 'default'
    }))
  }, [modelPricing])
  
  // 获取令牌列表（通过后端代理）
  const loadTokens = async () => {
    setTokenLoading(true)
    try {
      // 不传递分页参数，让后端直接转发到站点API，避免不同站点分页参数不一致的问题
      const res = await fetch(`/api/sites/${id}/tokens`, { 
        headers: authHeaders() 
      })
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || '获取令牌列表失败')
      }
      const data = await res.json()
      if (data.success && data.data) {
        // 严格的数组类型检查，确保传给Table的一定是数组
        let tokenList = []
        if (Array.isArray(data.data)) {
          tokenList = data.data
        } else if (data.data.items && Array.isArray(data.data.items)) {
          tokenList = data.data.items
        } else if (data.data.data && Array.isArray(data.data.data)) {
          tokenList = data.data.data
        }
        console.log('令牌列表加载成功:', tokenList)
        setTokens(tokenList)
      } else {
        throw new Error(data.message || '获取令牌列表失败')
      }
    } catch (e) {
      message.error(e.message || '获取令牌列表失败')
      setTokens([])
    } finally {
      setTokenLoading(false)
    }
  }
  
  // 获取分组列表（通过后端代理）
  const loadGroups = async () => {
    try {
      const res = await fetch(`/api/sites/${id}/groups`, { 
        headers: authHeaders() 
      })
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || '获取分组列表失败')
      }
      const data = await res.json()
      if (data.success && data.data) {
        // 只显示从API获取的分组，不添加"用户分组"
        const groupList = Object.keys(data.data).map(key => ({
          value: key,
          label: data.data[key].name || data.data[key].desc || key
        }))
        setGroups(groupList)
        console.log('分组列表加载成功:', groupList)
        return groupList  // 返回分组列表
      } else {
        console.warn('获取分组列表响应格式不正确:', data)
        setGroups([])
        return []
      }
    } catch (e) {
      console.error('获取分组列表失败:', e)
      message.error('获取分组列表失败: ' + e.message)
      setGroups([])
      return []
    }
  }
  
  // 删除令牌（通过后端代理）
  const deleteToken = async (tokenId) => {
    try {
      const res = await fetch(`/api/sites/${id}/tokens/${tokenId}`, {
        method: 'DELETE',
        headers: authHeaders()
      })
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || '删除令牌失败')
      }
      const data = await res.json()
      if (data.success) {
        message.success('删除成功')
        loadTokens()
      } else {
        throw new Error(data.message || '删除令牌失败')
      }
    } catch (e) {
      message.error(e.message || '删除令牌失败')
    }
  }
  
  // 修改令牌（通过后端代理）
  const updateToken = async (values) => {
    try {
      // 处理过期时间
      let expiredTime = -1
      if (values.neverExpire) {
        expiredTime = -1
      } else if (values.expiredTime) {
        expiredTime = Math.floor(values.expiredTime.valueOf() / 1000)
      }
      
      // 将特殊标识转换回空字符串
      const groupValue = values.group === '__user_group__' ? '' : values.group
      
      const payload = {
        id: editingToken.id,
        name: values.name,
        group: groupValue,
        expired_time: expiredTime,
        unlimited_quota: values.unlimitedQuota,
        remain_quota: values.unlimitedQuota ? 0 : (values.remainQuota || 0),
        model_limits_enabled: values.modelLimitsEnabled || false,
        model_limits: values.modelLimits || '',
        allow_ips: values.allowIps || ''
      }
      
      const res = await fetch(`/api/sites/${id}/tokens`, {
        method: 'PUT',
        headers: authHeaders(true),
        body: JSON.stringify(payload)
      })
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || '修改令牌失败')
      }
      const data = await res.json()
      if (data.success) {
        message.success('修改成功')
        setEditModalVisible(false)
        setEditingToken(null)
        form.resetFields()
        loadTokens()
      } else {
        throw new Error(data.message || '修改令牌失败')
      }
    } catch (e) {
      message.error(e.message || '修改令牌失败')
    }
  }
  
  // 打开编辑弹窗
  const openEditModal = async (token) => {
    setEditingToken(token)
    // 如果分组列表为空，先加载分组列表
    let currentGroups = groups
    if (currentGroups.length === 0) {
      currentGroups = await loadGroups()  // 使用返回值
    }
    
    // 如果当前令牌的分组为空（用户分组），且不在选项列表中，临时添加一个只读选项用于显示
    const tokenGroup = token.group || ''
    if (tokenGroup === '' || !currentGroups.some(g => g.value === tokenGroup)) {
      const displayGroups = [...currentGroups]
      if (tokenGroup === '') {
        // 用户分组，添加一个显示用的选项
        displayGroups.unshift({ 
          value: '__user_group__', 
          label: '用户分组（当前）', 
          disabled: true 
        })
        setGroups(displayGroups)
        // 使用特殊值来显示
        form.setFieldsValue({
          name: token.name,
          group: '__user_group__',
          neverExpire: token.expired_time === -1,
          expiredTime: token.expired_time !== -1 ? dayjs(token.expired_time * 1000) : null,
          unlimitedQuota: token.unlimited_quota,
          remainQuota: token.remain_quota,
          modelLimitsEnabled: token.model_limits_enabled,
          modelLimits: token.model_limits,
          allowIps: token.allow_ips
        })
      } else {
        form.setFieldsValue({
          name: token.name,
          group: tokenGroup,
          neverExpire: token.expired_time === -1,
          expiredTime: token.expired_time !== -1 ? dayjs(token.expired_time * 1000) : null,
          unlimitedQuota: token.unlimited_quota,
          remainQuota: token.remain_quota,
          modelLimitsEnabled: token.model_limits_enabled,
          modelLimits: token.model_limits,
          allowIps: token.allow_ips
        })
      }
    } else {
      form.setFieldsValue({
        name: token.name,
        group: tokenGroup,
        neverExpire: token.expired_time === -1,
        expiredTime: token.expired_time !== -1 ? dayjs(token.expired_time * 1000) : null,
        unlimitedQuota: token.unlimited_quota,
        remainQuota: token.remain_quota,
        modelLimitsEnabled: token.model_limits_enabled,
        modelLimits: token.model_limits,
        allowIps: token.allow_ips
      })
    }
    
    setEditModalVisible(true)
  }
  
  // 打开令牌管理弹窗
  const openTokenModal = () => {
    setTokenModalVisible(true)
    loadGroups()
    loadTokens()
  }
  
  // 打开创建令牌弹窗
  const openCreateModal = async () => {
    await loadGroups()
    createForm.resetFields()
    // 设置默认值
    createForm.setFieldsValue({
      name: '',
      neverExpire: true,
      unlimitedQuota: true,
      remainQuota: 500000,
      modelLimitsEnabled: false
    })
    setCreateModalVisible(true)
  }
  
  // 创建令牌
  const handleCreateToken = async () => {
    try {
      const values = await createForm.validateFields()
      const payload = {
        name: values.name,
        group: values.group || '',
        expired_time: values.neverExpire ? -1 : Math.floor(values.expiredTime.valueOf() / 1000),
        unlimited_quota: values.unlimitedQuota,
        remain_quota: values.unlimitedQuota ? 0 : values.remainQuota,
        model_limits_enabled: values.modelLimitsEnabled || false,
        model_limits: values.modelLimitsEnabled ? (values.modelLimits || '') : '',
        allow_ips: values.allowIps || ''
      }
      
      const res = await fetch(`/api/sites/${id}/tokens`, {
        method: 'POST',
        headers: authHeaders(true),
        body: JSON.stringify(payload)
      })
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || '创建令牌失败')
      }
      
      const data = await res.json()
      if (data.success) {
        message.success('创建成功！')
        setCreateModalVisible(false)
        createForm.resetFields()
        loadTokens()
      } else {
        throw new Error(data.message || '创建令牌失败')
      }
    } catch (e) {
      if (e.errorFields) {
        message.error('请填写完整信息')
      } else {
        message.error(e.message || '创建令牌失败')
      }
    }
  }
  
  // 打开兑换码弹窗
  const openRedeemModal = () => {
    setRedeemModalVisible(true)
    setRedeemCodes('')
    setRedeemResults([])
  }
  
  // 兑换码
  const handleRedeem = async () => {
    if (!redeemCodes.trim()) {
      message.warning('请输入兑换码')
      return
    }
    
    setRedeemLoading(true)
    const codes = redeemCodes.split('\n').map(code => code.trim()).filter(code => code)
    const results = []
    
    try {
      for (const code of codes) {
        try {
          // 使用后端代理路由，避免跨域问题
          const res = await fetch(`/api/sites/${id}/redeem`, {
            method: 'POST',
            headers: {
              ...authHeaders(),
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ key: code })
          })
          const data = await res.json()
          results.push({
            code,
            success: data.success,
            message: data.message || (data.success ? '兑换成功' : '兑换失败')
          })
        } catch (e) {
          results.push({
            code,
            success: false,
            message: '请求失败: ' + e.message
          })
        }
      }
      
      setRedeemResults(results)
      
      const successCount = results.filter(r => r.success).length
      const failCount = results.filter(r => !r.success).length
      
      if (successCount > 0 && failCount === 0) {
        message.success(`全部兑换成功！成功 ${successCount} 个`)
      } else if (successCount > 0) {
        message.warning(`部分兑换成功：成功 ${successCount} 个，失败 ${failCount} 个`)
      } else {
        message.error(`全部兑换失败！失败 ${failCount} 个`)
      }
    } catch (e) {
      message.error('兑换失败: ' + e.message)
    } finally {
      setRedeemLoading(false)
    }
  }
  
  const load = async () => {
    try {
      const res = await fetch(`/api/sites/${id}/diffs?limit=50`, { headers: authHeaders() })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || '加载变更历史失败')
      }
      const data = await res.json()
      setDiffs(data)
    } catch (e) { 
      message.error(e.message || '加载变更历史失败，请稍后重试') 
    }
    try {
      const sres = await fetch(`/api/sites/${id}/snapshots?limit=1`, { headers: authHeaders() })
      if (!sres.ok) {
        const sdata = await sres.json().catch(() => ({}))
        throw new Error(sdata.error || '加载模型列表失败')
      }
      const sdata = await sres.json()
      let items = Array.isArray(sdata) && sdata.length ? (sdata[0].modelsJson || []) : []
      items = items.filter(m => !String(m.id || '').toLowerCase().includes('custom'))
      console.log('快照中的前5个模型名称:', items.slice(0, 5).map(m => m.id))
      setSnapshot(items)
    } catch (e) { 
      message.error(e.message || '加载模型列表失败，请稍后重试') 
    }
    // 加载子站点列表
    try {
      const subsitesRes = await fetch(`/api/sites/${id}/subsites`, { headers: authHeaders() })
      if (subsitesRes.ok) {
        const subsitesData = await subsitesRes.json()
        setSubSites(subsitesData)
      }
    } catch (e) {
      console.error('加载子站点失败:', e)
    }
    // 加载模型价格信息
    try {
      const pricingRes = await fetch(`/api/sites/${id}/pricing`, { headers: authHeaders() })
      if (pricingRes.ok) {
        const pricingData = await pricingRes.json()
        console.log('完整的pricing API响应:', pricingData)
        
        const siteType = pricingData.siteType || 'newapi'
        console.log('站点类型:', siteType)
        
        // 转换为 { modelName: pricingInfo } 的格式
        const pricingMap = {}
        if (pricingData && pricingData.data) {
          // 提取group_ratio，用于计算不同分组的实际价格
          const groupRatio = pricingData.group_ratio || {}
          console.log('分组倍率:', groupRatio)
          
          // OneHub 类型的数据是对象，其他类型是数组
          const dataItems = Array.isArray(pricingData.data) 
            ? pricingData.data 
            : Object.entries(pricingData.data).map(([modelName, modelData]) => ({
                model_name: modelName,
                ...modelData,
                // OneHub 的价格结构：直接提供 input/output
                quota_type: modelData.price?.type === 'tokens' ? 0 : 1,
                model_ratio: 1,
                model_price: {
                  input: modelData.price?.input || 0,
                  output: modelData.price?.output || 0
                },
                completion_ratio: modelData.price?.output / modelData.price?.input || 1,
                enable_groups: modelData.groups?.length > 0 ? modelData.groups : ['default']
              }))
          
          console.log('处理后的数据项数量:', dataItems.length)
          if (dataItems.length > 0) {
            console.log('第一个数据项:', dataItems[0])
          }
          
          dataItems.forEach(item => {
            const modelRatio = item.model_ratio || 1
            const completionRatio = item.completion_ratio || 1
            const quotaType = item.quota_type || 0
            
            let inputPrice, outputPrice
            
            if (siteType === 'onehub' || siteType === 'donehub') {
              // OneHub/DoneHub: 直接使用 model_price 中的 input/output
              if (typeof item.model_price === 'object') {
                if (quotaType === 1) {
                  // 按次计费：API返回的单位是"千分之一美元"，需要除以1000，然后×2
                  inputPrice = (item.model_price.input || 0) / 1000 * 2
                  outputPrice = (item.model_price.output || 0) / 1000 * 2
                } else {
                  // 按量计费：API返回的是基础价格，需要×2（与NewAPI一致）
                  inputPrice = (item.model_price.input || 0) * 2
                  outputPrice = (item.model_price.output || 0) * 2
                }
              } else {
                inputPrice = 0
                outputPrice = 0
              }
            } else {
              // NewAPI/Veloera/其他: 使用倍率计算
              if (quotaType === 0) {
                // 按量计费
                // inputUSD (每 1M token) = model_ratio × 2
                // outputUSD (每 1M token) = model_ratio × completion_ratio × 2
                inputPrice = modelRatio * 2
                outputPrice = modelRatio * completionRatio * 2
              } else {
                // 按次计费：使用 model_price
                if (typeof item.model_price === 'object') {
                  inputPrice = item.model_price.input || 0
                  outputPrice = item.model_price.output || 0
                } else {
                  inputPrice = item.model_price || 0
                  outputPrice = item.model_price || 0
                }
              }
            }
            
            pricingMap[item.model_name] = {
              input: inputPrice,
              output: outputPrice,
              modelRatio: modelRatio,
              completionRatio: completionRatio,
              quotaType: quotaType, // 0=按量, 1=按次
              groups: item.enable_groups || [],
              groupRatio: groupRatio, // 保存分组倍率信息
              siteType: siteType
            }
            
            // 调试：打印前3个模型的价格
            if (Object.keys(pricingMap).length <= 3) {
              console.log(`[价格解析] ${item.model_name}:`, {
                input: inputPrice,
                output: outputPrice,
                quotaType: quotaType,
                siteType: siteType
              })
            }
          })
          
          console.log('解析后的模型价格:', pricingMap)
          console.log('第一个模型的价格详情:', Object.values(pricingMap)[0])
          console.log('价格数据的所有模型名称:', Object.keys(pricingMap))
        }
        setModelPricing(pricingMap)
      }
    } catch (e) {
      console.log('获取价格信息失败，将使用默认值:', e)
    }
  }
  
  useEffect(() => { 
    load() 
  }, [id])
  
  const checkNow = async () => {
    setLoading(true)
    try {
      // 手动检测不发送邮件通知
      const res = await fetch(`/api/sites/${id}/check?skipNotification=true`, { method: 'POST', headers: authHeaders() })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || '检测失败')
      await load()
      message.success('检测完成，数据已刷新')
    } catch (e) { 
      message.error(e.message || '检测失败，请检查站点配置') 
    } finally { setLoading(false) }
  }
  
  // 子站点管理函数
  const handleAddSubSite = () => {
    setEditingSubSite(null)
    subSiteForm.resetFields()
    setSubSiteModalVisible(true)
  }
  
  const handleEditSubSite = (subSite) => {
    setEditingSubSite(subSite)
    subSiteForm.setFieldsValue(subSite)
    setSubSiteModalVisible(true)
  }
  
  const handleSubSiteSubmit = async () => {
    try {
      const values = await subSiteForm.validateFields()
      const url = editingSubSite 
        ? `/api/sites/${id}/subsites/${editingSubSite.id}`
        : `/api/sites/${id}/subsites`
      const method = editingSubSite ? 'PATCH' : 'POST'
      
      const res = await fetch(url, {
        method,
        headers: authHeaders(true),
        body: JSON.stringify(values)
      })
      
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || '操作失败')
      }
      
      message.success(editingSubSite ? '修改成功' : '添加成功')
      setSubSiteModalVisible(false)
      load()
    } catch (e) {
      message.error(e.message || '操作失败')
    }
  }
  
  const handleDeleteSubSite = async (subSiteId) => {
    try {
      const res = await fetch(`/api/sites/${id}/subsites/${subSiteId}`, {
        method: 'DELETE',
        headers: authHeaders()
      })
      
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || '删除失败')
      }
      
      message.success('删除成功')
      load()
    } catch (e) {
      message.error(e.message || '删除失败')
    }
  }

  const totalAdded = useMemo(() => 
    diffs.reduce((sum, d) => sum + (d.addedJson?.length || 0), 0)
  , [diffs])
  
  const totalRemoved = useMemo(() => 
    diffs.reduce((sum, d) => sum + (d.removedJson?.length || 0), 0)
  , [diffs])
  
  return (
    <div>
      <Button 
        icon={<ArrowLeftOutlined />}
        onClick={() => nav('/')}
        size="large"
        style={{ 
          marginBottom: 20,
          fontSize: 15,
          borderRadius: '10px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
          transition: 'all 0.3s ease'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateX(-4px)';
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.12)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateX(0)';
          e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.08)';
        }}
      >
        返回站点列表
      </Button>

      <Card 
        className="fade-in"
        style={{
          borderRadius: 16,
          boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
          marginBottom: 24,
          background: 'linear-gradient(135deg, #ffffff 0%, #f5f7fa 100%)',
          border: '1px solid rgba(24, 144, 255, 0.1)',
          overflow: 'hidden',
          position: 'relative'
        }}
      >
        <div style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: '200px',
          height: '200px',
          background: 'radial-gradient(circle, rgba(24, 144, 255, 0.1) 0%, transparent 70%)',
          borderRadius: '50%',
          transform: 'translate(50%, -50%)',
          pointerEvents: 'none'
        }} />
        <Row gutter={24} style={{ position: 'relative', zIndex: 1 }}>
          <Col span={8}>
            <div style={{ 
              padding: '16px',
              borderRadius: '12px',
              background: 'rgba(24, 144, 255, 0.05)',
              transition: 'all 0.3s ease',
              cursor: 'pointer'
            }}
            className="stat-card"
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.boxShadow = '0 8px 16px rgba(24, 144, 255, 0.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
            >
              <Statistic 
                title={<span style={{ fontSize: 15, fontWeight: 600, color: '#666' }}>当前模型数</span>}
                value={snapshot.length}
                prefix={<ApiOutlined style={{ color: '#1890ff' }} />}
                valueStyle={{ color: '#1890ff', fontSize: 36, fontWeight: 800 }}
              />
            </div>
          </Col>
          <Col span={8}>
            <div style={{ 
              padding: '16px',
              borderRadius: '12px',
              background: 'rgba(82, 196, 26, 0.05)',
              transition: 'all 0.3s ease',
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.boxShadow = '0 8px 16px rgba(82, 196, 26, 0.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
            >
              <Statistic 
                title={<span style={{ fontSize: 15, fontWeight: 600, color: '#666' }}>历史新增</span>}
                value={totalAdded}
                prefix={<PlusCircleOutlined style={{ color: '#52c41a' }} />}
                valueStyle={{ color: '#52c41a', fontSize: 36, fontWeight: 800 }}
              />
            </div>
          </Col>
          <Col span={8}>
            <div style={{ 
              padding: '16px',
              borderRadius: '12px',
              background: 'rgba(255, 77, 79, 0.05)',
              transition: 'all 0.3s ease',
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.boxShadow = '0 8px 16px rgba(255, 77, 79, 0.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
            >
              <Statistic 
                title={<span style={{ fontSize: 15, fontWeight: 600, color: '#666' }}>历史移除</span>}
                value={totalRemoved}
                prefix={<MinusCircleOutlined style={{ color: '#ff4d4f' }} />}
                valueStyle={{ color: '#ff4d4f', fontSize: 36, fontWeight: 800 }}
              />
            </div>
          </Col>
        </Row>
      </Card>

      {/* 功能气泡区域 */}
      <Row gutter={16} style={{ marginBottom: 24 }} className="slide-in-right">
        <Col span={12}>
          <Card
            hoverable
            onClick={openTokenModal}
            style={{
              borderRadius: 20,
              boxShadow: '0 8px 32px rgba(24, 144, 255, 0.25)',
              background: 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)',
              border: 'none',
              cursor: 'pointer',
              minHeight: 140,
              position: 'relative',
              overflow: 'hidden',
              transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
            bodyStyle={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              padding: '32px',
              position: 'relative',
              zIndex: 1
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-8px) scale(1.02)';
              e.currentTarget.style.boxShadow = '0 16px 48px rgba(24, 144, 255, 0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0) scale(1)';
              e.currentTarget.style.boxShadow = '0 8px 32px rgba(24, 144, 255, 0.25)';
            }}
          >
            <div style={{
              position: 'absolute',
              top: '-50%',
              right: '-20%',
              width: '200px',
              height: '200px',
              background: 'radial-gradient(circle, rgba(255, 255, 255, 0.2) 0%, transparent 70%)',
              borderRadius: '50%',
              pointerEvents: 'none'
            }} />
            <KeyOutlined style={{ 
              fontSize: 56, 
              color: '#fff', 
              marginBottom: 16,
              filter: 'drop-shadow(0 4px 8px rgba(0, 0, 0, 0.2))',
              animation: 'bounce 2s ease-in-out infinite'
            }} />
            <Typography.Title level={3} style={{ margin: 0, color: '#fff', fontWeight: 700 }}>
              令牌管理
            </Typography.Title>
            <Typography.Text style={{ 
              color: 'rgba(255,255,255,0.95)', 
              marginTop: 12,
              fontSize: 15,
              fontWeight: 500
            }}>
              查看、修改和删除API令牌
            </Typography.Text>
          </Card>
        </Col>
        <Col span={12}>
          <Card
            hoverable
            onClick={openRedeemModal}
            style={{
              borderRadius: 20,
              boxShadow: '0 8px 32px rgba(19, 194, 194, 0.25)',
              background: 'linear-gradient(135deg, #13c2c2 0%, #08979c 100%)',
              border: 'none',
              cursor: 'pointer',
              minHeight: 140,
              position: 'relative',
              overflow: 'hidden',
              transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
            bodyStyle={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              padding: '32px',
              position: 'relative',
              zIndex: 1
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-8px) scale(1.02)';
              e.currentTarget.style.boxShadow = '0 16px 48px rgba(19, 194, 194, 0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0) scale(1)';
              e.currentTarget.style.boxShadow = '0 8px 32px rgba(19, 194, 194, 0.25)';
            }}
          >
            <div style={{
              position: 'absolute',
              top: '-50%',
              right: '-20%',
              width: '200px',
              height: '200px',
              background: 'radial-gradient(circle, rgba(255, 255, 255, 0.2) 0%, transparent 70%)',
              borderRadius: '50%',
              pointerEvents: 'none'
            }} />
            <GiftOutlined style={{ 
              fontSize: 56, 
              color: '#fff', 
              marginBottom: 16,
              filter: 'drop-shadow(0 4px 8px rgba(0, 0, 0, 0.2))',
              animation: 'pulse 2s ease-in-out infinite'
            }} />
            <Typography.Title level={3} style={{ margin: 0, color: '#fff', fontWeight: 700 }}>
              兑换码
            </Typography.Title>
            <Typography.Text style={{ 
              color: 'rgba(255,255,255,0.95)', 
              marginTop: 12,
              fontSize: 15,
              fontWeight: 500
            }}>
              使用兑换码充值余额
            </Typography.Text>
          </Card>
        </Col>
      </Row>
      
      {/* 子站点列表 */}
      <Card 
        className="fade-in"
        title={<span style={{ fontSize: 16, fontWeight: 600 }}>签到子站点</span>}
        extra={
          <Button type="primary" icon={<PlusCircleOutlined />} onClick={handleAddSubSite}>
            添加子站点
          </Button>
        }
        style={{
          borderRadius: 16,
          boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
          marginBottom: 24
        }}
      >
        {subSites.length === 0 ? (
          <Empty description="暂无子站点" />
        ) : (
          <List
            dataSource={subSites}
            renderItem={(subSite) => (
              <List.Item
                actions={[
                  <Button 
                    type="link" 
                    icon={<EditOutlined />} 
                    onClick={() => handleEditSubSite(subSite)}
                  >
                    编辑
                  </Button>,
                  <Popconfirm
                    title="确定删除此子站点吗？"
                    onConfirm={() => handleDeleteSubSite(subSite.id)}
                    okText="确定"
                    cancelText="取消"
                  >
                    <Button type="link" danger icon={<DeleteOutlined />}>
                      删除
                    </Button>
                  </Popconfirm>
                ]}
              >
                <List.Item.Meta
                  title={subSite.name}
                  description={
                    <Typography.Link href={subSite.url} target="_blank">
                      {subSite.url}
                    </Typography.Link>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </Card>

      <Card 
        className="fade-in-up"
        title={
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <ApiOutlined style={{ marginRight: 12, fontSize: 24, color: '#1890ff' }} />
            <Typography.Title level={4} style={{ margin: 0, fontWeight: 700 }}>当前模型列表</Typography.Title>
          </div>
        }
        extra={
          <Space size="middle">
            <Button 
              icon={modelsExpanded ? <UpOutlined /> : <DownOutlined />}
              onClick={() => setModelsExpanded(!modelsExpanded)}
              size="large"
              style={{ 
                fontSize: 15,
                borderRadius: '8px',
                transition: 'all 0.3s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              {modelsExpanded ? '收起' : '展开'}
            </Button>
            <Button 
              icon={<CopyOutlined />}
              onClick={() => copyAllModels(snapshot)}
              size="large"
              disabled={snapshot.length === 0}
              style={{ 
                fontSize: 15,
                borderRadius: '8px',
                transition: 'all 0.3s ease'
              }}
              onMouseEnter={(e) => {
                if (snapshot.length > 0) {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              复制全部模型
            </Button>
            <Button 
              type="primary"
              size="large"
              icon={<ThunderboltOutlined />}
              loading={loading}
              onClick={checkNow}
              style={{
                height: 44,
                fontSize: 15,
                fontWeight: 600,
                borderRadius: '10px',
                transition: 'all 0.3s ease'
              }}
              onMouseEnter={(e) => {
                if (!loading) {
                  e.currentTarget.style.transform = 'translateY(-2px) scale(1.03)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0) scale(1)';
              }}
            >
              {loading ? '检测中...' : '立即检测并刷新'}
            </Button>
          </Space>
        }
        style={{
          borderRadius: 16,
          boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
          marginBottom: 24,
          border: '1px solid rgba(24, 144, 255, 0.1)'
        }}
      >
        {snapshot.length === 0 ? (
          <Empty 
            description="暂无模型数据，请先执行检测"
            style={{ padding: '40px 0' }}
          />
        ) : (
          <>
            {/* 搜索和筛选区域 */}
            <div style={{ marginBottom: 20 }}>
              <Row gutter={[16, 16]}>
                <Col xs={24} md={12}>
                  <div>
                    <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>搜索模型</Typography.Text>
                    <Input
                      placeholder="输入模型名称或描述..."
                      prefix={<ApiOutlined style={{ color: '#bfbfbf' }} />}
                      value={modelSearchText}
                      onChange={(e) => setModelSearchText(e.target.value)}
                      allowClear
                      style={{ borderRadius: 8 }}
                    />
                  </div>
                </Col>
                <Col xs={24} md={12}>
                  <div>
                    <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>用户分组</Typography.Text>
                    <Select
                      value={selectedGroup}
                      onChange={setSelectedGroup}
                      style={{ width: '100%' }}
                    >
                      <Select.Option value="all">全部分组</Select.Option>
                      {availableGroups.map((g) => (
                        <Select.Option key={g.value} value={g.value}>
                          {g.label}
                        </Select.Option>
                      ))}
                    </Select>
                  </div>
                </Col>
              </Row>
            </div>

            {/* 显示选项开关 */}
            <div style={{ 
              marginBottom: 20, 
              padding: '12px 16px',
              background: '#fafafa',
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              gap: 24,
              flexWrap: 'wrap'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <ApiOutlined style={{ color: '#666' }} />
                <Typography.Text strong style={{ color: '#666' }}>显示选项:</Typography.Text>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Typography.Text>真实充值金额</Typography.Text>
                <Switch 
                  checked={showRealPrice} 
                  onChange={setShowRealPrice}
                  size="small"
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Typography.Text>显示倍率</Typography.Text>
                <Switch 
                  checked={showMultiplier} 
                  onChange={setShowMultiplier}
                  size="small"
                  defaultChecked
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Typography.Text>端点类型</Typography.Text>
                <Switch 
                  checked={showEndpoint} 
                  onChange={setShowEndpoint}
                  size="small"
                  defaultChecked
                />
              </div>
            </div>

            {/* 功能按钮和统计 */}
            <div style={{ marginBottom: 20, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <Button 
                icon={<CopyOutlined />}
                onClick={() => copyAllModels(filteredAndGroupedModels.filtered)}
              >
                复制所有模型名称
              </Button>
              <Typography.Text type="secondary" style={{ marginLeft: 'auto' }}>
                总计 {snapshot.length} 个模型 | 显示 {filteredAndGroupedModels.filtered.length} 个
              </Typography.Text>
            </div>

            {/* 提供者标签筛选 */}
            <div style={{ marginBottom: 20 }}>
              <Space wrap>
                <Button
                  type={selectedProvider === 'all' ? 'primary' : 'default'}
                  onClick={() => setSelectedProvider('all')}
                  icon={<ApiOutlined />}
                  style={{ borderRadius: 20 }}
                >
                  所有厂商 ({snapshot.length})
                </Button>
                {providers.map(([provider, count]) => (
                  <Button
                    key={provider}
                    type={selectedProvider === provider ? 'primary' : 'default'}
                    onClick={() => setSelectedProvider(provider)}
                    style={{ borderRadius: 20 }}
                  >
                    {getProviderIcon(provider)} {provider} ({count})
                  </Button>
                ))}
              </Space>
            </div>

            {/* 模型列表 */}
            {modelsExpanded && (
              filteredAndGroupedModels.filtered.length === 0 ? (
                <Empty description="没有匹配的模型" style={{ padding: '40px 0' }} />
              ) : (
                <List
                  grid={{ gutter: 12, xs: 1, sm: 2, md: 2, lg: 3, xl: 4, xxl: 5 }}
                  dataSource={filteredAndGroupedModels.filtered}
                  pagination={filteredAndGroupedModels.filtered.length > 50 ? {
                    pageSize: 50,
                    showSizeChanger: false,
                    showTotal: (total) => `共 ${total} 个模型`,
                    position: 'bottom',
                    style: { marginTop: 16, textAlign: 'center' }
                  } : false}
                  renderItem={(m) => (
                    <EnhancedModelCard 
                      key={m.id} 
                      model={m} 
                      onCopy={copyToClipboard}
                      showRealPrice={showRealPrice}
                      showMultiplier={showMultiplier}
                      showEndpoint={showEndpoint}
                      pricing={modelPricing[m.id]}
                    />
                  )}
                />
              )
            )}
          </>
        )}
      </Card>

      <Card 
        title={<Typography.Title level={4} style={{ margin: 0 }}>变更历史记录</Typography.Title>}
        style={{
          borderRadius: 16,
          boxShadow: '0 4px 20px rgba(0,0,0,0.08)'
        }}
      >
        {diffs.length === 0 ? (
          <Empty 
            description="暂无变更记录"
            style={{ padding: '40px 0' }}
          />
        ) : (
          <Collapse 
            accordion
            style={{ background: 'transparent', border: 'none' }}
          >
            {diffs.map(d => (
              <Collapse.Panel 
                header={
                  <Space>
                    <ClockCircleOutlined style={{ color: '#1890ff' }} />
                    <Typography.Text strong style={{ fontSize: 15 }}>
                      {new Date(d.diffAt).toLocaleString('zh-CN')}
                    </Typography.Text>
                    <Tag color="green">+{d.addedJson?.length || 0}</Tag>
                    <Tag color="red">-{d.removedJson?.length || 0}</Tag>
                  </Space>
                }
                key={d.id}
                style={{ 
                  marginBottom: 12,
                  border: '1px solid #e8e8e8',
                  borderRadius: 8,
                  overflow: 'hidden'
                }}
              >
                <Space direction="vertical" style={{ width: '100%' }} size={16}>
                  <Section title="新增模型" items={d.addedJson} type="success" icon={<PlusCircleOutlined />} />
                  <Section title="移除模型" items={d.removedJson} type="error" icon={<MinusCircleOutlined />} />
                </Space>
              </Collapse.Panel>
            ))}
          </Collapse>
        )}
      </Card>

      {/* 令牌管理弹窗 - 移动端使用Drawer */}
      {isMobile ? (
        <Drawer
          title={
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography.Title level={4} style={{ margin: 0 }}>令牌管理</Typography.Title>
              <Button 
                type="primary" 
                icon={<PlusCircleOutlined />}
                onClick={openCreateModal}
              >
                创建令牌
              </Button>
            </div>
          }
          open={tokenModalVisible}
          onClose={() => setTokenModalVisible(false)}
          placement="bottom"
          height="90%"
        >
          {tokenLoading ? (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <Typography.Text>加载中...</Typography.Text>
            </div>
          ) : tokens.length === 0 ? (
            <Empty description="暂无令牌，点击右上角创建新令牌" />
          ) : (
            <List
              grid={{ gutter: 16, xs: 1, sm: 1, md: 1 }}
              dataSource={tokens}
              renderItem={(token) => <TokenCard token={token} onEdit={openEditModal} onDelete={deleteToken} />}
            />
          )}
        </Drawer>
      ) : (
        <Modal
          title={
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingRight: 24 }}>
              <Typography.Title level={4} style={{ margin: 0 }}>令牌管理</Typography.Title>
              <Button 
                type="primary" 
                icon={<PlusCircleOutlined />}
                onClick={openCreateModal}
              >
                创建令牌
              </Button>
            </div>
          }
          open={tokenModalVisible}
          onCancel={() => setTokenModalVisible(false)}
          footer={null}
          width={1200}
          style={{ top: 20 }}
        >
          {tokenLoading ? (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <Typography.Text>加载中...</Typography.Text>
            </div>
          ) : tokens.length === 0 ? (
            <Empty description="暂无令牌，点击右上角创建新令牌" />
          ) : (
            <List
              grid={{ gutter: 16, xs: 1, sm: 2, md: 2, lg: 3 }}
              dataSource={tokens}
              renderItem={(token) => <TokenCard token={token} onEdit={openEditModal} onDelete={deleteToken} />}
            />
          )}
        </Modal>
      )}

      {/* 令牌编辑弹窗 */}
      <Modal
        title={<Typography.Title level={4} style={{ margin: 0 }}>编辑令牌</Typography.Title>}
        open={editModalVisible}
        onCancel={() => {
          setEditModalVisible(false)
          setEditingToken(null)
          form.resetFields()
        }}
        onOk={() => form.submit()}
        width={600}
        okText="保存"
        cancelText="取消"
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={updateToken}
          style={{ marginTop: 24 }}
        >
          <Form.Item
            label="名称"
            name="name"
            rules={[{ required: true, message: '请输入令牌名称' }]}
          >
            <Input placeholder="请输入令牌名称" />
          </Form.Item>

          <Form.Item
            label="分组"
            name="group"
            rules={[{ required: true, message: '请选择分组' }]}
          >
            <Select 
              placeholder="请选择分组"
              showSearch
              optionFilterProp="label"
              options={groups}
            />
          </Form.Item>

          <Form.Item label="过期时间">
            <Space direction="vertical" style={{ width: '100%' }}>
              <Form.Item name="neverExpire" valuePropName="checked" noStyle>
                <Switch checkedChildren="永不过期" unCheckedChildren="设置过期时间" />
              </Form.Item>
              <Form.Item
                noStyle
                shouldUpdate={(prevValues, currentValues) => prevValues.neverExpire !== currentValues.neverExpire}
              >
                {({ getFieldValue }) =>
                  !getFieldValue('neverExpire') && (
                    <Form.Item name="expiredTime">
                      <DatePicker
                        showTime
                        format="YYYY-MM-DD HH:mm:ss"
                        placeholder="选择过期时间"
                        style={{ width: '100%' }}
                      />
                    </Form.Item>
                  )
                }
              </Form.Item>
            </Space>
          </Form.Item>

          <Form.Item label="额度">
            <Space direction="vertical" style={{ width: '100%' }}>
              <Form.Item name="unlimitedQuota" valuePropName="checked" noStyle>
                <Switch checkedChildren="无限额" unCheckedChildren="设置额度" />
              </Form.Item>
              <Form.Item
                noStyle
                shouldUpdate={(prevValues, currentValues) => prevValues.unlimitedQuota !== currentValues.unlimitedQuota}
              >
                {({ getFieldValue }) =>
                  !getFieldValue('unlimitedQuota') && (
                    <Form.Item name="remainQuota" label="剩余额度（原始值）">
                      <InputNumber
                        placeholder="请输入剩余额度"
                        style={{ width: '100%' }}
                        min={0}
                      />
                    </Form.Item>
                  )
                }
              </Form.Item>
            </Space>
          </Form.Item>

          <Form.Item
            label="IP白名单"
            name="allowIps"
            extra="一行一个IP地址，不填则不限制"
          >
            <Input.TextArea
              placeholder="例如：&#10;192.168.1.1&#10;10.0.0.1&#10;172.16.0.0/12"
              rows={4}
            />
          </Form.Item>

          <Form.Item name="modelLimitsEnabled" valuePropName="checked" label="启用模型限制">
            <Switch />
          </Form.Item>

          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) => prevValues.modelLimitsEnabled !== currentValues.modelLimitsEnabled}
          >
            {({ getFieldValue }) =>
              getFieldValue('modelLimitsEnabled') && (
                <Form.Item
                  label="模型限制"
                  name="modelLimits"
                  extra="多个模型请用逗号分隔"
                >
                  <Input.TextArea
                    placeholder="例如: gpt-4, gpt-3.5-turbo"
                    rows={3}
                  />
                </Form.Item>
              )
            }
          </Form.Item>
        </Form>
      </Modal>

      {/* 创建令牌弹窗 */}
      <Modal
        title={<Typography.Title level={4} style={{ margin: 0 }}>创建令牌</Typography.Title>}
        open={createModalVisible}
        onCancel={() => {
          setCreateModalVisible(false)
          createForm.resetFields()
        }}
        onOk={handleCreateToken}
        width={600}
        okText="创建"
        cancelText="取消"
      >
        <Form
          form={createForm}
          layout="vertical"
          style={{ marginTop: 24 }}
        >
          <Form.Item
            label="名称"
            name="name"
            rules={[{ required: true, message: '请输入令牌名称' }]}
          >
            <Input placeholder="请输入令牌名称" />
          </Form.Item>

          <Form.Item
            label="分组"
            name="group"
            extra="不选择则使用用户默认分组"
          >
            <Select 
              placeholder="请选择分组（可选）"
              allowClear
              showSearch
              optionFilterProp="label"
              options={groups}
            />
          </Form.Item>

          <Form.Item label="过期时间">
            <Space direction="vertical" style={{ width: '100%' }}>
              <Form.Item name="neverExpire" valuePropName="checked" noStyle>
                <Switch checkedChildren="永不过期" unCheckedChildren="设置过期时间" defaultChecked />
              </Form.Item>
              <Form.Item
                noStyle
                shouldUpdate={(prevValues, currentValues) => prevValues.neverExpire !== currentValues.neverExpire}
              >
                {({ getFieldValue }) =>
                  !getFieldValue('neverExpire') && (
                    <Form.Item name="expiredTime" rules={[{ required: true, message: '请选择过期时间' }]}>
                      <DatePicker
                        showTime
                        format="YYYY-MM-DD HH:mm:ss"
                        placeholder="选择过期时间"
                        style={{ width: '100%' }}
                      />
                    </Form.Item>
                  )
                }
              </Form.Item>
            </Space>
          </Form.Item>

          <Form.Item label="额度">
            <Space direction="vertical" style={{ width: '100%' }}>
              <Form.Item name="unlimitedQuota" valuePropName="checked" noStyle>
                <Switch checkedChildren="无限额" unCheckedChildren="设置额度" defaultChecked />
              </Form.Item>
              <Form.Item
                noStyle
                shouldUpdate={(prevValues, currentValues) => prevValues.unlimitedQuota !== currentValues.unlimitedQuota}
              >
                {({ getFieldValue }) =>
                  !getFieldValue('unlimitedQuota') && (
                    <Form.Item name="remainQuota" label="初始额度（原始值，1美元 = 500000）" rules={[{ required: true, message: '请输入初始额度' }]}>
                      <InputNumber
                        placeholder="请输入初始额度"
                        style={{ width: '100%' }}
                        min={0}
                      />
                    </Form.Item>
                  )
                }
              </Form.Item>
            </Space>
          </Form.Item>

          <Form.Item
            label="IP白名单"
            name="allowIps"
            extra="一行一个IP地址，不填则不限制"
          >
            <Input.TextArea
              placeholder="例如：&#10;192.168.1.1&#10;10.0.0.1&#10;172.16.0.0/12"
              rows={4}
            />
          </Form.Item>

          <Form.Item name="modelLimitsEnabled" valuePropName="checked" label="启用模型限制">
            <Switch />
          </Form.Item>

          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) => prevValues.modelLimitsEnabled !== currentValues.modelLimitsEnabled}
          >
            {({ getFieldValue }) =>
              getFieldValue('modelLimitsEnabled') && (
                <Form.Item
                  label="模型限制"
                  name="modelLimits"
                  extra="多个模型请用逗号分隔"
                >
                  <Input.TextArea
                    placeholder="例如: gpt-4, gpt-3.5-turbo"
                    rows={3}
                  />
                </Form.Item>
              )
            }
          </Form.Item>
        </Form>
      </Modal>

      {/* 兑换码弹窗 */}
      <Modal
        title={<Typography.Title level={4} style={{ margin: 0 }}>创建令牌</Typography.Title>}
        open={createModalVisible}
        onCancel={() => {
          setCreateModalVisible(false)
          createForm.resetFields()
        }}
        onOk={handleCreateToken}
        width={600}
        okText="创建"
        cancelText="取消"
      >
        <Form
          form={createForm}
          layout="vertical"
          style={{ marginTop: 24 }}
        >
          <Form.Item
            label="名称"
            name="name"
            rules={[{ required: true, message: '请输入令牌名称' }]}
          >
            <Input placeholder="请输入令牌名称" />
          </Form.Item>

          <Form.Item
            label="分组"
            name="group"
            extra="不选择则使用用户默认分组"
          >
            <Select 
              placeholder="请选择分组（可选）"
              allowClear
              showSearch
              optionFilterProp="label"
              options={groups}
            />
          </Form.Item>

          <Form.Item label="过期时间">
            <Space direction="vertical" style={{ width: '100%' }}>
              <Form.Item name="neverExpire" valuePropName="checked" noStyle>
                <Switch checkedChildren="永不过期" unCheckedChildren="设置过期时间" defaultChecked />
              </Form.Item>
              <Form.Item
                noStyle
                shouldUpdate={(prevValues, currentValues) => prevValues.neverExpire !== currentValues.neverExpire}
              >
                {({ getFieldValue }) =>
                  !getFieldValue('neverExpire') && (
                    <Form.Item name="expiredTime" rules={[{ required: true, message: '请选择过期时间' }]}>
                      <DatePicker
                        showTime
                        format="YYYY-MM-DD HH:mm:ss"
                        placeholder="选择过期时间"
                        style={{ width: '100%' }}
                      />
                    </Form.Item>
                  )
                }
              </Form.Item>
            </Space>
          </Form.Item>

          <Form.Item label="额度">
            <Space direction="vertical" style={{ width: '100%' }}>
              <Form.Item name="unlimitedQuota" valuePropName="checked" noStyle>
                <Switch checkedChildren="无限额" unCheckedChildren="设置额度" defaultChecked />
              </Form.Item>
              <Form.Item
                noStyle
                shouldUpdate={(prevValues, currentValues) => prevValues.unlimitedQuota !== currentValues.unlimitedQuota}
              >
                {({ getFieldValue }) =>
                  !getFieldValue('unlimitedQuota') && (
                    <Form.Item name="remainQuota" label="初始额度（原始值，1美元 = 500000）" rules={[{ required: true, message: '请输入初始额度' }]}>
                      <InputNumber
                        placeholder="请输入初始额度"
                        style={{ width: '100%' }}
                        min={0}
                      />
                    </Form.Item>
                  )
                }
              </Form.Item>
            </Space>
          </Form.Item>

          <Form.Item
            label="IP白名单"
            name="allowIps"
            extra="一行一个IP地址，不填则不限制"
          >
            <Input.TextArea
              placeholder="例如：&#10;192.168.1.1&#10;10.0.0.1&#10;172.16.0.0/12"
              rows={4}
            />
          </Form.Item>

          <Form.Item name="modelLimitsEnabled" valuePropName="checked" label="启用模型限制">
            <Switch />
          </Form.Item>

          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) => prevValues.modelLimitsEnabled !== currentValues.modelLimitsEnabled}
          >
            {({ getFieldValue }) =>
              getFieldValue('modelLimitsEnabled') && (
                <Form.Item
                  label="模型限制"
                  name="modelLimits"
                  extra="多个模型请用逗号分隔"
                >
                  <Input.TextArea
                    placeholder="例如: gpt-4, gpt-3.5-turbo"
                    rows={3}
                  />
                </Form.Item>
              )
            }
          </Form.Item>
        </Form>
      </Modal>

      {/* 兑换码弹窗 */}
      <Modal
        title={<Typography.Title level={4} style={{ margin: 0 }}>兑换码充值</Typography.Title>}
        open={redeemModalVisible}
        onCancel={() => {
          setRedeemModalVisible(false)
          setRedeemCodes('')
          setRedeemResults([])
        }}
        width={600}
        footer={null}
      >
        <div style={{ marginTop: 24 }}>
          <Typography.Text strong>输入兑换码</Typography.Text>
          <Typography.Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
            （每行一个兑换码，支持批量兑换）
          </Typography.Text>
          <Input.TextArea
            value={redeemCodes}
            onChange={(e) => setRedeemCodes(e.target.value)}
            placeholder="请输入兑换码，每行一个&#10;例如：&#10;0e61536d4d50352ef20933448be0d9f1&#10;1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p"
            rows={6}
            style={{ marginTop: 12 }}
          />
          
          <Button
            type="primary"
            size="large"
            loading={redeemLoading}
            onClick={handleRedeem}
            block
            style={{
              marginTop: 16,
              background: 'linear-gradient(135deg, #13c2c2 0%, #08979c 100%)',
              border: 'none',
              height: 48,
              fontSize: 16,
              fontWeight: 600
            }}
          >
            {redeemLoading ? '兑换中...' : '立即兑换'}
          </Button>

          {redeemResults.length > 0 && (
            <div style={{ marginTop: 24 }}>
              <Typography.Title level={5}>兑换结果</Typography.Title>
              <List
                size="small"
                dataSource={redeemResults}
                renderItem={(item) => (
                  <List.Item>
                    <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                      <Typography.Text 
                        ellipsis 
                        style={{ maxWidth: 300 }}
                        copyable
                      >
                        {item.code}
                      </Typography.Text>
                      <Tag color={item.success ? 'success' : 'error'}>
                        {item.message}
                      </Tag>
                    </Space>
                  </List.Item>
                )}
                style={{
                  maxHeight: 300,
                  overflow: 'auto',
                  border: '1px solid #f0f0f0',
                  borderRadius: 8,
                  padding: '8px 0'
                }}
              />
            </div>
          )}
        </div>
      </Modal>
      
      {/* 子站点管理Modal */}
      <Modal
        title={editingSubSite ? '编辑子站点' : '添加子站点'}
        open={subSiteModalVisible}
        onOk={handleSubSiteSubmit}
        onCancel={() => setSubSiteModalVisible(false)}
        okText="确定"
        cancelText="取消"
      >
        <Form form={subSiteForm} layout="vertical">
          <Form.Item
            label="子站点名称"
            name="name"
            rules={[{ required: true, message: '请输入子站点名称' }]}
          >
            <Input placeholder="例如：签到站点1" />
          </Form.Item>
          <Form.Item
            label="子站点URL"
            name="url"
            rules={[
              { required: true, message: '请输入子站点URL' },
              { type: 'url', message: '请输入有效的URL' }
            ]}
          >
            <Input placeholder="https://example.com" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

// 模型卡片组件 - 使用 memo 优化
// 增强的模型卡片组件 - 显示价格和状态
const EnhancedModelCard = memo(({ model, onCopy, showRealPrice, showMultiplier, showEndpoint, pricing }) => {
  const provider = getModelProvider(model.id)
  
  // 调试：检查价格数据
  if (!pricing && Math.random() < 0.02) { // 只打印2%的模型，避免刷屏
    console.log(`[模型 ${model.id}] 没有找到价格数据`)
  }
  
  // 获取模型价格（如果有pricing数据）
  const getModelPrice = (type) => {
    if (!pricing) {
      // 没有价格数据，显示默认值
      return '$2.00/M'
    }
    
    let basePrice = type === 'input' ? pricing.input : pricing.output
    
    // 应用分组倍率（最终价格 = 基础价格 × groupRatio）
    if (pricing.groupRatio && typeof pricing.groupRatio === 'object') {
      // 默认使用 'default' 分组的倍率
      const userGroup = 'default'
      const groupMultiplier = pricing.groupRatio[userGroup] || 1
      basePrice = basePrice * groupMultiplier
    }
    
    if (typeof basePrice === 'number') {
      // 根据价格大小决定显示精度
      let formattedPrice
      if (basePrice < 0.01) {
        formattedPrice = basePrice.toFixed(4) // 小于0.01显示4位小数
      } else if (basePrice < 1) {
        formattedPrice = basePrice.toFixed(3) // 小于1显示3位小数
      } else {
        formattedPrice = basePrice.toFixed(2) // 大于等于1显示2位小数
      }
      
      // 如果是按次计费
      if (pricing.quotaType === 1) {
        return `$${formattedPrice}/次`
      }
      // 按量计费，显示每百万tokens的价格
      return `$${formattedPrice}/M`
    }
    
    return '$2.00/M'
  }
  
  // 获取倍率
  const getMultiplier = () => {
    if (!pricing) return '倍率: 1x / 补全: 1x'
    const modelRatio = pricing.modelRatio || 1
    const completionRatio = pricing.completionRatio || 1
    return `倍率: ${modelRatio}x / 补全: ${completionRatio}x`
  }
  
  // 获取计费类型
  const getBillingType = () => {
    if (!pricing) return '按量计费'
    return pricing.quotaType === 1 ? '按次计费' : '按量计费'
  }
  
  return (
    <List.Item>
      <Card 
        size="small"
        hoverable
        style={{ 
          borderRadius: 12,
          background: '#fff',
          border: '1px solid #e8e8e8',
          position: 'relative',
          transition: 'all 0.3s ease',
          height: '100%'
        }}
        bodyStyle={{ padding: '14px' }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-2px)'
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)'
          e.currentTarget.style.boxShadow = 'none'
        }}
      >
        {/* 提供者图标 */}
        <div style={{
          position: 'absolute',
          top: 10,
          left: 10
        }}>
          {getProviderIcon(provider, 24)}
        </div>
        
        {/* 复制按钮 */}
        <Button
          type="text"
          size="small"
          icon={<CopyOutlined />}
          onClick={() => onCopy(model.id, `已复制: ${model.id}`)}
          style={{
            position: 'absolute',
            top: 6,
            right: 6,
            fontSize: 12,
            color: '#1890ff'
          }}
        />
        
        {/* 模型名称 */}
        <Typography.Text 
          strong 
          style={{ 
            fontSize: 13,
            display: 'block',
            marginTop: 26,
            marginBottom: 8,
            color: '#333',
            paddingRight: 24,
            lineHeight: 1.4,
            wordBreak: 'break-word'
          }}
        >
          {model.id}
        </Typography.Text>
        
        {/* 标签组 */}
        <div style={{ marginBottom: 10, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {showEndpoint && (
            <Tag 
              color={pricing?.quotaType === 1 ? 'orange' : 'blue'} 
              style={{ fontSize: 10, borderRadius: 4 }}
            >
              {getBillingType()}
            </Tag>
          )}
          <Tag color="success" style={{ fontSize: 10, borderRadius: 4 }}>
            可用
          </Tag>
        </div>
        
        {/* 价格信息 */}
        <div style={{ fontSize: 11, color: '#666' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span>输入:</span>
            <Typography.Text style={{ color: '#1890ff', fontSize: 11, fontWeight: 600 }}>
              {getModelPrice('input')}
            </Typography.Text>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: showMultiplier ? 4 : 0 }}>
            <span>输出:</span>
            <Typography.Text style={{ color: '#52c41a', fontSize: 11, fontWeight: 600 }}>
              {getModelPrice('output')}
            </Typography.Text>
          </div>
          {showMultiplier && (
            <div style={{ paddingTop: 6, borderTop: '1px solid #f0f0f0' }}>
              <Typography.Text strong style={{ fontSize: 10, color: '#666', display: 'block', textAlign: 'center' }}>
                {getMultiplier()}
              </Typography.Text>
            </div>
          )}
        </div>
      </Card>
    </List.Item>
  )
})

EnhancedModelCard.displayName = 'EnhancedModelCard'

// 令牌卡片组件
const TokenCard = memo(({ token, onEdit, onDelete }) => {
  const [keyVisible, setKeyVisible] = useState(false)
  const fullKey = `sk-${token.key}`
  const displayKey = keyVisible ? fullKey : `${fullKey.slice(0, 12)}...${fullKey.slice(-8)}`
  
  const copyKey = () => {
    navigator.clipboard.writeText(fullKey).then(() => {
      message.success('令牌已复制')
    }).catch(() => {
      message.error('复制失败')
    })
  }
  
  return (
    <List.Item>
      <Card
        hoverable
        style={{
          borderRadius: 12,
          border: '1px solid #e8e8e8',
          transition: 'all 0.3s ease'
        }}
        bodyStyle={{ padding: 16 }}
      >
        {/* 顶部：名称和状态 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <div style={{ flex: 1 }}>
            <Typography.Title level={5} style={{ margin: 0, marginBottom: 4 }}>
              {token.name}
            </Typography.Title>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              ID: {token.id}
            </Typography.Text>
          </div>
          <Tag color={token.status === 1 ? 'success' : 'error'} style={{ marginLeft: 8 }}>
            {token.status === 1 ? '启用' : '禁用'}
          </Tag>
        </div>

        {/* 密钥显示 */}
        <div style={{ 
          background: '#f5f5f5', 
          padding: '8px 12px', 
          borderRadius: 8,
          marginBottom: 12,
          display: 'flex',
          alignItems: 'center',
          gap: 8
        }}>
          <Typography.Text 
            code
            style={{ 
              flex: 1,
              fontFamily: 'monospace',
              fontSize: '12px',
              wordBreak: 'break-all'
            }}
          >
            {displayKey}
          </Typography.Text>
          <Button
            type="text"
            size="small"
            icon={keyVisible ? <EyeInvisibleOutlined /> : <EyeOutlined />}
            onClick={() => setKeyVisible(!keyVisible)}
            style={{ padding: '0 4px' }}
          />
          <Button
            type="text"
            size="small"
            icon={<CopyOutlined />}
            onClick={copyKey}
            style={{ padding: '0 4px' }}
          />
        </div>

        {/* 详细信息 */}
        <div style={{ marginBottom: 12, fontSize: 13 }}>
          <div style={{ marginBottom: 4 }}>
            <span style={{ color: '#666' }}>剩余额度: </span>
            {token.unlimited_quota ? (
              <Tag color="gold" style={{ fontSize: 11 }}>无限额度</Tag>
            ) : (
              <Typography.Text strong>${(token.remain_quota / 500000).toFixed(2)}</Typography.Text>
            )}
          </div>
          <div style={{ marginBottom: 4 }}>
            <span style={{ color: '#666' }}>已用额度: </span>
            <Typography.Text>${(token.used_quota / 500000).toFixed(2)}</Typography.Text>
          </div>
          <div style={{ marginBottom: 4 }}>
            <span style={{ color: '#666' }}>过期时间: </span>
            {token.expired_time === -1 ? (
              <Tag color="green" style={{ fontSize: 11 }}>永不过期</Tag>
            ) : (
              <Typography.Text>{new Date(token.expired_time * 1000).toLocaleString('zh-CN')}</Typography.Text>
            )}
          </div>
          <div>
            <span style={{ color: '#666' }}>分组: </span>
            {token.group && token.group !== '' ? (
              <Tag color="blue" style={{ fontSize: 11 }}>{token.group}</Tag>
            ) : (
              <Tag color="default" style={{ fontSize: 11 }}>default</Tag>
            )}
          </div>
        </div>

        {/* 创建时间 */}
        <div style={{ 
          paddingTop: 12, 
          borderTop: '1px solid #f0f0f0',
          fontSize: 12,
          color: '#999',
          marginBottom: 12
        }}>
          创建时间: {new Date(token.created_time * 1000).toLocaleString('zh-CN')}
        </div>

        {/* 操作按钮 */}
        <div style={{ display: 'flex', gap: 8 }}>
          <Button
            type="primary"
            size="small"
            icon={<EditOutlined />}
            onClick={() => onEdit(token)}
            style={{ flex: 1 }}
          >
            编辑
          </Button>
          <Popconfirm
            title="确认删除"
            description="确定要删除这个令牌吗？"
            onConfirm={() => onDelete(token.id)}
            okText="确认"
            cancelText="取消"
          >
            <Button
              danger
              size="small"
              icon={<DeleteOutlined />}
              style={{ flex: 1 }}
            >
              删除
            </Button>
          </Popconfirm>
        </div>
      </Card>
    </List.Item>
  )
})

TokenCard.displayName = 'TokenCard'

const ModelCard = memo(({ model, onCopy }) => (
  <List.Item>
    <Card 
      size="small"
      hoverable
      style={{ 
        borderRadius: 8,
        background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
        border: '1px solid #e8e8e8',
        position: 'relative'
      }}
      bodyStyle={{ padding: '12px' }}
    >
      <Button
        type="text"
        size="small"
        icon={<CopyOutlined />}
        onClick={() => onCopy(model.id, `已复制: ${model.id}`)}
        style={{
          position: 'absolute',
          top: 4,
          right: 4,
          fontSize: 12,
          color: '#1890ff'
        }}
      />
      <Typography.Text 
        strong 
        style={{ 
          fontSize: 13,
          display: 'block',
          marginBottom: 6,
          color: '#333',
          paddingRight: 24
        }}
      >
        {model.id}
      </Typography.Text>
      <Typography.Text 
        type="secondary" 
        style={{ 
          fontSize: 12,
          display: 'block'
        }}
      >
        {model.owned_by || model.ownedBy || '未知'}
      </Typography.Text>
    </Card>
  </List.Item>
))

ModelCard.displayName = 'ModelCard'

// 变更项卡片组件 - 使用 memo 优化
const DiffItemCard = memo(({ item, type, onCopy }) => {
  const colorMap = {
    success: '#52c41a',
    error: '#ff4d4f'
  }

  return (
    <List.Item style={{ marginBottom: 8 }}>
      <Card 
        size="small"
        style={{ 
          borderRadius: 6,
          border: `1px solid ${colorMap[type]}`,
          background: '#fff',
          position: 'relative'
        }}
        bodyStyle={{ padding: 12 }}
      >
        <Button
          type="text"
          size="small"
          icon={<CopyOutlined />}
          onClick={() => onCopy(item.id, `已复制: ${item.id}`)}
          style={{
            position: 'absolute',
            top: 4,
            right: 4,
            fontSize: 11,
            padding: '2px 4px',
            height: 'auto'
          }}
        />
        <Typography.Text strong style={{ fontSize: 14, color: '#333', display: 'block', marginBottom: 6, paddingRight: 24 }}>
          {item.id}
        </Typography.Text>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {item.owned_by || item.ownedBy || '未知提供者'}
        </Typography.Text>
      </Card>
    </List.Item>
  )
})

DiffItemCard.displayName = 'DiffItemCard'

const Section = memo(({ title, items, type, icon }) => {
  if (!items || items.length === 0) {
    return null
  }

  const colorMap = {
    success: '#52c41a',
    error: '#ff4d4f'
  }

  const copyToClipboard = useCallback((text, successMsg = '复制成功') => {
    navigator.clipboard.writeText(text).then(() => {
      message.success(successMsg)
    }).catch(() => {
      message.error('复制失败，请手动复制')
    })
  }, [])

  const copyAllModels = useCallback(() => {
    const names = items.map(m => m.id).join(',')
    copyToClipboard(names, `已复制 ${items.length} 个模型名称`)
  }, [items, copyToClipboard])

  return (
    <div style={{ 
      background: '#fafafa', 
      padding: 16, 
      borderRadius: 8,
      border: '1px solid #e8e8e8'
    }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: 12
      }}>
        <Typography.Title 
          level={5} 
          style={{ 
            margin: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            color: colorMap[type]
          }}
        >
          {icon}
          {title} ({items.length})
        </Typography.Title>
        <Button
          size="small"
          icon={<CopyOutlined />}
          onClick={copyAllModels}
          style={{ fontSize: 13 }}
        >
          复制全部
        </Button>
      </div>
      <List
        size="small"
        dataSource={items}
        grid={{ gutter: 8, xs: 1, sm: 1, md: 2, lg: 2, xl: 3 }}
        pagination={items.length > 30 ? {
          pageSize: 30,
          showSizeChanger: false,
          size: 'small',
          showTotal: (total) => `共 ${total} 个`,
        } : false}
        renderItem={(item) => <DiffItemCard key={item.id} item={item} type={type} onCopy={copyToClipboard} />}
      />
    </div>
  )
})

Section.displayName = 'Section'
