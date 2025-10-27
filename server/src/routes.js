const path = require('path');
const { authPlugin } = require('./auth');
const { prisma } = require('./db');
const { encrypt } = require('./crypto');
const { onSiteUpdated, scheduleGlobalTask } = require('./scheduler');
const { checkSiteById } = require('./run');

// 字段映射函数
function mapNewFormatToSite(accountData) {
  const { 
    site_name, site_url, site_type, authType, account_info, 
    checkIn, exchange_rate, notes, health 
  } = accountData;
  
  // 映射API类型
  const apiTypeMap = {
    'new-api': 'newapi',
    'done-hub': 'donehub', 
    'Veloera': 'veloera',
    'voapi': 'voapi'
  };
  
  const apiType = apiTypeMap[site_type] || 'other';
  
  // 构建备注信息
  let siteNotes = notes || '';
  if (exchange_rate) {
    siteNotes += `\n汇率: ${exchange_rate}`;
  }
  if (health && health.reason) {
    siteNotes += `\n状态: ${health.reason}`;
  }
  if (account_info?.username) {
    siteNotes += `\n用户名: ${account_info.username}`;
  }
  
  // 处理签到URL
  const subSites = [];
  if (checkIn && checkIn.customCheckInUrl) {
    subSites.push({
      name: '签到页面',
      url: checkIn.customCheckInUrl
    });
  }
  
  // 根据API类型决定是否需要userId
  // DoneHub 和 VOAPI 不需要 userId，其他类型需要
  let userId = null;
  if (apiType === 'newapi' || apiType === 'veloera') {
    // 这些类型必须有 userId
    userId = account_info?.id?.toString() || null;
  } else if (apiType === 'donehub' || apiType === 'voapi') {
    // 这些类型不需要 userId，设为 null
    userId = null;
  } else {
    // 其他类型，如果有就保存
    userId = account_info?.id?.toString() || null;
  }
  
  return {
    name: site_name,
    baseUrl: site_url,
    apiKey: account_info?.access_token || '',
    apiType,
    userId,
    enableCheckIn: checkIn?.enableDetection || false,
    checkInMode: 'both',
    subSites,
    notes: siteNotes.trim()
  };
}

function mapOriginalFormatToSite(siteData) {
  const { 
    id, createdAt, updatedAt, apiKey, categoryName, category,
    name, baseUrl, apiType = 'other', userId = null,
    scheduleCron = null, timezone = 'UTC', pinned = false, excludeFromBatch = false,
    billingUrl = null, billingAuthType = 'token', billingAuthValue = null,
    billingLimitField = null, billingUsageField = null, unlimitedQuota = false,
    enableCheckIn = false, checkInMode = 'both'
  } = siteData;
  
  return {
    name,
    baseUrl,
    apiKey,
    apiType,
    userId,
    scheduleCron,
    timezone,
    pinned,
    excludeFromBatch,
    billingUrl,
    billingAuthType,
    billingAuthValue,
    billingLimitField,
    billingUsageField,
    unlimitedQuota,
    enableCheckIn,
    checkInMode,
    categoryName
  };
}

async function routes(fastify) {
  await fastify.register(authPlugin);

  fastify.addHook('onRequest', async (request, reply) => {
    if (process.env.SKIP_AUTH === 'true') return;
    if (request.url.startsWith('/api/auth/')) return;
    try {
      await request.jwtVerify();
    } catch (err) {
      return reply.code(401).send({ error: '未授权访问，请重新登录' });
    }
  });

  fastify.get('/api/sites', async (request) => {
    const { search } = request.query || {};
    const { decrypt } = require('./crypto');
    const userId = request.user.sub; // 获取当前登录用户ID
    
    // 只获取当前用户的站点
    const sites = await prisma.site.findMany({ 
      where: { ownerId: userId },
      orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
      include: { 
        category: true,
        subSites: {
          orderBy: { createdAt: 'asc' }
        }
      }
    });
    
    // 为每个站点获取最新的billing信息和模型信息
    const sitesWithBilling = await Promise.all(sites.map(async (site) => {
      // 先获取最新的快照（无论是否有错误），用于获取billing信息
      const latestSnapshotForBilling = await prisma.modelSnapshot.findFirst({
        where: { siteId: site.id },
        orderBy: { fetchedAt: 'desc' },
        select: { 
          billingLimit: true, 
          billingUsage: true, 
          billingError: true,
          errorMessage: true,
          checkInSuccess: true, 
          checkInMessage: true, 
          checkInError: true 
        }
      });
      
      // 获取最新的成功快照（用于模型信息）
      const latestSuccessSnapshot = await prisma.modelSnapshot.findFirst({
        where: { 
          siteId: site.id,
          errorMessage: null  // 只取成功的快照
        },
        orderBy: { fetchedAt: 'desc' },
        select: { modelsJson: true }
      });
      
      // 优先使用最新快照的billing信息，即使它有错误
      // 因为billing检测和模型检测是独立的，billing可能成功而模型失败
      const billingInfo = latestSnapshotForBilling ? {
        billingLimit: latestSnapshotForBilling.billingLimit,
        billingUsage: latestSnapshotForBilling.billingUsage,
        billingError: latestSnapshotForBilling.billingError,
        checkInSuccess: latestSnapshotForBilling.checkInSuccess,
        checkInMessage: latestSnapshotForBilling.checkInMessage,
        checkInError: latestSnapshotForBilling.checkInError
      } : {
        billingLimit: null,
        billingUsage: null,
        billingError: null,
        checkInSuccess: null,
        checkInMessage: null,
        checkInError: null
      };
      
      const { apiKeyEnc, ...rest } = site;
      return {
        ...rest,
        apiKey: apiKeyEnc ? decrypt(apiKeyEnc) : null, // 解密API密钥
        ...billingInfo,
        _modelsJson: latestSuccessSnapshot?.modelsJson || '[]' // 用于搜索
      };
    }));
    
    // 如果有搜索关键词，进行过滤
    if (search && search.trim()) {
      const searchLower = search.trim().toLowerCase();
      return sitesWithBilling.filter(site => {
        // 搜索站点名称
        if (site.name.toLowerCase().includes(searchLower)) return true;
        // 搜索站点链接
        if (site.baseUrl.toLowerCase().includes(searchLower)) return true;
        // 搜索模型ID
        try {
          const models = JSON.parse(site._modelsJson);
          if (Array.isArray(models)) {
            return models.some(model => model.id && model.id.toLowerCase().includes(searchLower));
          }
        } catch (e) {
          // 忽略JSON解析错误
        }
        return false;
      }).map(site => {
        // 移除临时的_modelsJson字段
        const { _modelsJson, ...rest } = site;
        return rest;
      });
    }
    
    // 移除临时的_modelsJson字段
    return sitesWithBilling.map(site => {
      const { _modelsJson, ...rest } = site;
      return rest;
    });
  });

  // 导出站点（必须在 /api/sites/:id 之前）
  fastify.get('/api/sites/export', async (request, reply) => {
    try {
      const currentUserId = request.user.sub;
      const sites = await prisma.site.findMany({
        where: { ownerId: currentUserId },
        orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
        include: { category: true }
      });
      
      // 不导出加密的敏感信息，导出原始apiKey和billingAuthValue
      const { decrypt } = require('./crypto');
      const exportData = sites.map(site => {
        const { apiKeyEnc, billingAuthValue, ownerId, ...siteData } = site;
        return {
          ...siteData,
          apiKey: apiKeyEnc ? decrypt(apiKeyEnc) : null,
          billingAuthValue: billingAuthValue ? decrypt(billingAuthValue) : null,
          // 导出分类名称而不是ID
          categoryName: site.category ? site.category.name : null,
          category: undefined // 移除category对象
        };
      });
      
      return {
        version: '1.0',
        exportDate: new Date().toISOString(),
        sites: exportData
      };
    } catch (e) {
      fastify.log.error(e);
      reply.code(500);
      return { error: '导出失败: ' + e.message };
    }
  });

  // 导出站点别名，避免与 /api/sites/:id 动态路由潜在冲突
  fastify.get('/api/exports/sites', async (request, reply) => {
    try {
      const currentUserId = request.user.sub;
      const { format } = request.query; // 支持 format=allapi 参数
      
      const sites = await prisma.site.findMany({
        where: { ownerId: currentUserId },
        orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
        include: { category: true }
      });

      const { decrypt } = require('./crypto');
      
      // 如果请求 all-api-hub 格式
      if (format === 'allapi') {
        const accounts = sites.map(site => {
          const apiType = site.apiType || 'new-api';
          const siteTypeMap = {
            'newapi': 'new-api',
            'veloera': 'Veloera',
            'donehub': 'done-hub',
            'onehub': 'done-hub', // OneHub 也导出为 done-hub
            'voapi': 'new-api',
            'other': 'new-api'
          };
          
          return {
            emoji: '',
            site_name: site.name,
            site_url: site.baseUrl,
            health: {
              status: 'healthy',
              reason: '账号状态正常'
            },
            site_type: siteTypeMap[apiType] || 'new-api',
            authType: 'access_token',
            exchange_rate: 7.3,
            notes: '',
            checkIn: {
              enableDetection: site.enableCheckIn || false,
              isCheckedInToday: false,
              customCheckInUrl: ''
            },
            account_info: {
              id: parseInt(site.userId) || 0,
              access_token: site.apiKeyEnc ? decrypt(site.apiKeyEnc) : '',
              username: '',
              quota: 0,
              today_prompt_tokens: 0,
              today_completion_tokens: 0,
              today_quota_consumption: 0,
              today_requests_count: 0,
              today_income: 0
            },
            last_sync_time: Date.now(),
            id: `account_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            created_at: new Date(site.createdAt).getTime(),
            updated_at: Date.now(),
            configVersion: 1
          };
        });
        
        return {
          version: '1.0',
          timestamp: Date.now(),
          type: 'accounts',
          data: {
            accounts,
            last_updated: Date.now()
          }
        };
      }
      
      // 默认格式（原始格式）
      const exportData = sites.map(site => {
        const { apiKeyEnc, billingAuthValue, ownerId, ...siteData } = site;
        return {
          ...siteData,
          apiKey: apiKeyEnc ? decrypt(apiKeyEnc) : null,
          billingAuthValue: billingAuthValue ? decrypt(billingAuthValue) : null,
          categoryName: site.category ? site.category.name : null,
          category: undefined
        };
      });

      return {
        version: '1.0',
        exportDate: new Date().toISOString(),
        sites: exportData
      };
    } catch (e) {
      fastify.log.error(e);
      reply.code(500);
      return { error: '导出失败: ' + e.message };
    }
  });

  // 导入站点（必须在 /api/sites/:id 之前）
  fastify.post('/api/sites/import', {
    schema: {
      body: {
        type: 'object',
        properties: {
          version: { type: 'string' },
          exportDate: { type: 'string' },
          sites: { type: 'array' },
          // 新格式支持
          type: { type: 'string' },
          data: {
            type: 'object',
            properties: {
              accounts: { type: 'array' }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const currentUserId = request.user.sub;
      const body = request.body;
      
      // 检测导入格式并提取站点数据
      let sites = [];
      let isNewFormat = false;
      
      if (body.data && body.data.accounts && Array.isArray(body.data.accounts)) {
        // 新格式：accounts-backup格式
        isNewFormat = true;
        sites = body.data.accounts;
      } else if (body.sites && Array.isArray(body.sites)) {
        // 原格式：标准导出格式
        sites = body.sites;
      } else {
        reply.code(400);
        return { error: '无效的导入数据格式' };
      }
      
      if (sites.length === 0) {
        reply.code(400);
        return { error: '没有找到可导入的站点数据' };
      }
      
      let imported = 0;
      let updated = 0;
      const errors = [];
      
      // 先获取当前用户的所有分类，用于匹配分类名称
      const categories = await prisma.category.findMany({
        where: { ownerId: currentUserId }
      });
      const categoryMap = new Map(categories.map(c => [c.name, c.id]));
      
      for (const siteData of sites) {
        try {
          let siteInfo;
          
          if (isNewFormat) {
            // 新格式字段映射
            siteInfo = mapNewFormatToSite(siteData);
          } else {
            // 原格式字段映射
            siteInfo = mapOriginalFormatToSite(siteData);
          }
          
          const { 
            name, baseUrl, apiKey, apiType = 'other', userId = null,
            scheduleCron = null, timezone = 'UTC', pinned = false, excludeFromBatch = false,
            billingUrl = null, billingAuthType = 'token', billingAuthValue = null,
            billingLimitField = null, billingUsageField = null, unlimitedQuota = false,
            enableCheckIn = false, checkInMode = 'both', categoryName = null,
            subSites = []
          } = siteInfo;
          
          if (!name || !baseUrl || !apiKey) {
            errors.push(`站点 ${name || '未知'} 缺少必要字段`);
            continue;
          }
          
          // 检查站点是否已存在（通过 baseUrl 和 ownerId）
          const existingSite = await prisma.site.findFirst({
            where: {
              ownerId: currentUserId,
              baseUrl: baseUrl
            }
          });
          
          // 匹配分类
          let categoryId = null;
          if (categoryName && categoryMap.has(categoryName)) {
            categoryId = categoryMap.get(categoryName);
          }
          
          // 加密敏感信息
          const apiKeyEnc = encrypt(apiKey);
          let billingAuthValueEnc = null;
          if (billingAuthValue) {
            billingAuthValueEnc = encrypt(billingAuthValue);
          }
          
          let site;
          
          if (existingSite) {
            // 更新现有站点
            site = await prisma.site.update({
              where: { id: existingSite.id },
              data: {
                name, apiKeyEnc, apiType, userId, scheduleCron, timezone, pinned, excludeFromBatch,
                categoryId,
                billingUrl, billingAuthType, billingAuthValue: billingAuthValueEnc,
                billingLimitField, billingUsageField, unlimitedQuota,
                enableCheckIn, checkInMode
              }
            });
            
            // 删除旧的子站点
            await prisma.subSite.deleteMany({
              where: { siteId: site.id }
            });
            
            updated++;
          } else {
            // 创建新站点
            site = await prisma.site.create({
              data: {
                ownerId: currentUserId,
                name, baseUrl, apiKeyEnc, apiType, userId, scheduleCron, timezone, pinned, excludeFromBatch,
                categoryId,
                billingUrl, billingAuthType, billingAuthValue: billingAuthValueEnc,
                billingLimitField, billingUsageField, unlimitedQuota,
                enableCheckIn, checkInMode
              }
            });
            
            imported++;
          }
          
          // 创建子站点（用于签到URL）
          if (subSites && subSites.length > 0) {
            for (const subSite of subSites) {
              await prisma.subSite.create({
                data: {
                  siteId: site.id,
                  name: subSite.name,
                  url: subSite.url
                }
              });
            }
          }
          
          onSiteUpdated(site, fastify);
        } catch (e) {
          errors.push(`站点 ${siteData.site_name || siteData.name || '未知'} 导入失败: ${e.message}`);
        }
      }
      
      if (errors.length > 0) {
        fastify.log.warn({ errors }, 'Import completed with errors');
      }
      
      return {
        imported,
        updated,
        total: sites.length,
        errors: errors.length > 0 ? errors : undefined,
        format: isNewFormat ? 'accounts-backup' : 'standard'
      };
    } catch (e) {
      fastify.log.error(e);
      reply.code(500);
      return { error: '导入失败: ' + e.message };
    }
  });

  fastify.post('/api/sites', {
    schema: {
      body: {
        type: 'object',
        required: ['name', 'baseUrl', 'apiKey'],
        properties: {
          name: { type: 'string', minLength: 1 },
          baseUrl: { type: 'string', minLength: 1 },
          apiKey: { type: 'string', minLength: 1 },
          apiType: { type: 'string', enum: ['newapi', 'veloera', 'donehub', 'voapi', 'other'] },
          userId: { type: 'string' },
          scheduleCron: { type: 'string' },
          timezone: { type: 'string' },
          pinned: { type: 'boolean' },
          excludeFromBatch: { type: 'boolean' },
          categoryId: { type: 'string' },
          billingUrl: { type: 'string' },
          billingAuthType: { type: 'string', enum: ['token', 'cookie'] },
          billingAuthValue: { type: 'string' },
          billingLimitField: { type: 'string' },
          billingUsageField: { type: 'string' },
          unlimitedQuota: { type: 'boolean' },
          enableCheckIn: { type: 'boolean' },
          checkInMode: { type: 'string', enum: ['model', 'checkin', 'both'] },
        },
      },
    },
  }, async (request) => {
    const { encrypt } = require('./crypto');
    const currentUserId = request.user.sub; // 获取当前登录用户ID
    const { 
      name, baseUrl, apiKey, apiType = 'other', userId = null, 
      scheduleCron = null, timezone = 'UTC', pinned = false, excludeFromBatch = false,
      categoryId = null,
      billingUrl = null, billingAuthType = 'token', billingAuthValue = null, 
      billingLimitField = null, billingUsageField = null, unlimitedQuota = false,
      enableCheckIn = false, checkInMode = 'both'
    } = request.body;
    
    const apiKeyEnc = encrypt(apiKey);
    let billingAuthValueEnc = null;
    if (billingAuthValue) {
      billingAuthValueEnc = encrypt(billingAuthValue);
    }
    
    const site = await prisma.site.create({ 
      data: { 
        ownerId: currentUserId, // 设置站点所有者为当前用户
        name, baseUrl, apiKeyEnc, apiType, userId, scheduleCron, timezone, pinned, excludeFromBatch,
        categoryId: categoryId || null, // 空字符串转换为 null
        billingUrl, billingAuthType, billingAuthValue: billingAuthValueEnc, 
        billingLimitField, billingUsageField, unlimitedQuota,
        enableCheckIn, checkInMode
      } 
    });
    onSiteUpdated(site, fastify);
    const { apiKeyEnc: _, ...rest } = site;
    return rest;
  });

  fastify.patch('/api/sites/:id', {
    schema: {
      params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
      body: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          baseUrl: { type: 'string' },
          apiKey: { type: 'string' },
          apiType: { type: 'string', enum: ['newapi', 'veloera', 'donehub', 'voapi', 'other'] },
          userId: { type: 'string' },
          scheduleCron: { type: 'string' },
          timezone: { type: 'string' },
          pinned: { type: 'boolean' },
          excludeFromBatch: { type: 'boolean' },
          categoryId: { type: 'string' },
          billingUrl: { type: 'string' },
          billingAuthType: { type: 'string', enum: ['token', 'cookie'] },
          billingAuthValue: { type: 'string' },
          billingLimitField: { type: 'string' },
          billingUsageField: { type: 'string' },
          unlimitedQuota: { type: 'boolean' },
          enableCheckIn: { type: 'boolean' },
          checkInMode: { type: 'string', enum: ['model', 'checkin', 'both'] },
        },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params;
    const currentUserId = request.user.sub;
    const data = {};
    const { 
      name, baseUrl, apiKey, apiType, userId, scheduleCron, timezone, pinned, excludeFromBatch,
      categoryId,
      billingUrl, billingAuthType, billingAuthValue, billingLimitField, billingUsageField, unlimitedQuota,
      enableCheckIn, checkInMode
    } = request.body || {};
    
    try {
      // 验证站点所有权
      const site = await prisma.site.findUnique({ where: { id } });
      if (!site) {
        reply.code(404);
        return { error: '站点不存在' };
      }
      if (site.ownerId !== currentUserId) {
        reply.code(403);
        return { error: '无权限修改此站点' };
      }
      
      if (name) data.name = name;
      if (baseUrl) data.baseUrl = baseUrl;
      if (apiType) data.apiType = apiType;
      if (userId !== undefined) data.userId = userId;
      if (scheduleCron !== undefined) data.scheduleCron = scheduleCron;
      if (timezone) data.timezone = timezone;
      if (pinned !== undefined) data.pinned = pinned;
      if (excludeFromBatch !== undefined) data.excludeFromBatch = excludeFromBatch;
      // categoryId: 空字符串转换为 null，避免外键约束错误
      if (categoryId !== undefined) data.categoryId = categoryId || null;
      if (billingUrl !== undefined) data.billingUrl = billingUrl;
      if (billingAuthType) data.billingAuthType = billingAuthType;
      if (billingAuthValue !== undefined) {
        data.billingAuthValue = billingAuthValue ? encrypt(billingAuthValue) : null;
      }
      if (billingLimitField !== undefined) data.billingLimitField = billingLimitField;
      if (billingUsageField !== undefined) data.billingUsageField = billingUsageField;
      if (unlimitedQuota !== undefined) data.unlimitedQuota = unlimitedQuota;
      if (enableCheckIn !== undefined) data.enableCheckIn = enableCheckIn;
      // checkInMode: 只在有值时更新
      if (checkInMode) {
        data.checkInMode = checkInMode;
      }
      if (apiKey) data.apiKeyEnc = encrypt(apiKey);
      
      fastify.log.info({ updateData: data }, 'Updating site');
      
      const updatedSite = await prisma.site.update({ where: { id }, data });
      onSiteUpdated(updatedSite, fastify);
      const { apiKeyEnc: _, ...rest } = updatedSite;
      return rest;
    } catch (error) {
      fastify.log.error({ error, id, body: request.body }, 'Failed to update site');
      reply.code(500);
      return { error: error.message || '更新站点失败' };
    }
  });

  fastify.delete('/api/sites/:id', {
    schema: { params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } },
  }, async (request, reply) => {
    const { id } = request.params;
    const currentUserId = request.user.sub;
    
    // 验证站点所有权
    const site = await prisma.site.findUnique({ where: { id } });
    if (!site) {
      reply.code(404);
      return { error: '站点不存在' };
    }
    if (site.ownerId !== currentUserId) {
      reply.code(403);
      return { error: '无权限删除此站点' };
    }
    
    await prisma.modelDiff.deleteMany({ where: { siteId: id } });
    await prisma.modelSnapshot.deleteMany({ where: { siteId: id } });
    await prisma.site.delete({ where: { id } });
    return { ok: true };
  });

  fastify.post('/api/sites/:id/check', {
    schema: { 
      params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
      querystring: { type: 'object', properties: { skipNotification: { type: 'string' } } }
    },
  }, async (request, reply) => {
    const { id } = request.params;
    const currentUserId = request.user.sub;
    const skipNotification = request.query?.skipNotification === 'true';
    
    // 验证站点所有权
    const site = await prisma.site.findUnique({ where: { id } });
    if (!site) {
      reply.code(404);
      return { error: '站点不存在' };
    }
    if (site.ownerId !== currentUserId) {
      reply.code(403);
      return { error: '无权限检测此站点' };
    }
    
    try {
      const result = await checkSiteById(id, fastify, { skipNotification, isManual: true });
      return { ok: true, message: '检测成功', ...result };
    } catch (e) {
      reply.code(500);
      return { ok: false, error: `检测失败：${e.message}` };
    }
  });

  // 获取单个站点详情（用于令牌管理等功能）
  fastify.get('/api/sites/:id', {
    schema: {
      params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] }
    }
  }, async (request, reply) => {
    const { id } = request.params;
    const currentUserId = request.user.sub;
    const { decrypt } = require('./crypto');
    
    try {
      const site = await prisma.site.findUnique({
        where: { id },
        include: { category: true }
      });
      
      if (!site) {
        reply.code(404);
        return { error: '站点不存在' };
      }
      
      // 验证站点所有权
      if (site.ownerId !== currentUserId) {
        reply.code(403);
        return { error: '无权限访问此站点' };
      }
      
      // 解密 API 密钥
      let token = null;
      if (site.apiKeyEnc) {
        try {
          token = decrypt(site.apiKeyEnc);
        } catch (e) {
          fastify.log.error({ error: e.message }, 'Failed to decrypt API key');
        }
      }
      
      // 解密 billing auth value
      let billingAuthValue = null;
      if (site.billingAuthValue) {
        try {
          billingAuthValue = decrypt(site.billingAuthValue);
        } catch (e) {
          fastify.log.error({ error: e.message }, 'Failed to decrypt billing auth value');
        }
      }
      
      // 返回站点信息（包含解密后的token）
      const { apiKeyEnc, ...rest } = site;
      return {
        ...rest,
        token,
        url: site.baseUrl,
        type: site.apiType,
        billingAuthValue
      };
    } catch (e) {
      fastify.log.error({ error: e.message }, 'Error fetching site');
      reply.code(500);
      return { error: '获取站点信息失败' };
    }
  });

  // ===== 子站点管理 API =====
  
  // 获取站点的所有子站点
  fastify.get('/api/sites/:id/subsites', {
    schema: {
      params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] }
    }
  }, async (request, reply) => {
    const { id } = request.params;
    const currentUserId = request.user.sub;
    
    try {
      // 验证站点所有权
      const site = await prisma.site.findUnique({ where: { id }, select: { ownerId: true } });
      if (!site) {
        reply.code(404);
        return { error: '站点不存在' };
      }
      if (site.ownerId !== currentUserId) {
        reply.code(403);
        return { error: '无权限访问此站点' };
      }
      
      // 获取子站点列表
      const subSites = await prisma.subSite.findMany({
        where: { siteId: id },
        orderBy: { createdAt: 'asc' }
      });
      
      return subSites;
    } catch (e) {
      fastify.log.error({ error: e.message }, 'Error fetching subsites');
      reply.code(500);
      return { error: '获取子站点列表失败' };
    }
  });
  
  // 添加子站点
  fastify.post('/api/sites/:id/subsites', {
    schema: {
      params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
      body: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          url: { type: 'string' }
        },
        required: ['name', 'url']
      }
    }
  }, async (request, reply) => {
    const { id } = request.params;
    const { name, url } = request.body;
    const currentUserId = request.user.sub;
    
    try {
      // 验证站点所有权
      const site = await prisma.site.findUnique({ where: { id }, select: { ownerId: true } });
      if (!site) {
        reply.code(404);
        return { error: '站点不存在' };
      }
      if (site.ownerId !== currentUserId) {
        reply.code(403);
        return { error: '无权限访问此站点' };
      }
      
      // 创建子站点
      const subSite = await prisma.subSite.create({
        data: {
          siteId: id,
          name,
          url
        }
      });
      
      return subSite;
    } catch (e) {
      fastify.log.error({ error: e.message }, 'Error creating subsite');
      reply.code(500);
      return { error: '创建子站点失败' };
    }
  });
  
  // 更新子站点
  fastify.patch('/api/sites/:siteId/subsites/:subSiteId', {
    schema: {
      params: {
        type: 'object',
        properties: {
          siteId: { type: 'string' },
          subSiteId: { type: 'string' }
        },
        required: ['siteId', 'subSiteId']
      },
      body: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          url: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    const { siteId, subSiteId } = request.params;
    const { name, url } = request.body;
    const currentUserId = request.user.sub;
    
    try {
      // 验证站点所有权
      const site = await prisma.site.findUnique({ where: { id: siteId }, select: { ownerId: true } });
      if (!site) {
        reply.code(404);
        return { error: '站点不存在' };
      }
      if (site.ownerId !== currentUserId) {
        reply.code(403);
        return { error: '无权限访问此站点' };
      }
      
      // 更新子站点
      const updateData = {};
      if (name !== undefined) updateData.name = name;
      if (url !== undefined) updateData.url = url;
      
      const subSite = await prisma.subSite.update({
        where: { id: subSiteId },
        data: updateData
      });
      
      return subSite;
    } catch (e) {
      fastify.log.error({ error: e.message }, 'Error updating subsite');
      reply.code(500);
      return { error: '更新子站点失败' };
    }
  });
  
  // 删除子站点
  fastify.delete('/api/sites/:siteId/subsites/:subSiteId', {
    schema: {
      params: {
        type: 'object',
        properties: {
          siteId: { type: 'string' },
          subSiteId: { type: 'string' }
        },
        required: ['siteId', 'subSiteId']
      }
    }
  }, async (request, reply) => {
    const { siteId, subSiteId } = request.params;
    const currentUserId = request.user.sub;
    
    try {
      // 验证站点所有权
      const site = await prisma.site.findUnique({ where: { id: siteId }, select: { ownerId: true } });
      if (!site) {
        reply.code(404);
        return { error: '站点不存在' };
      }
      if (site.ownerId !== currentUserId) {
        reply.code(403);
        return { error: '无权限访问此站点' };
      }
      
      // 删除子站点
      await prisma.subSite.delete({
        where: { id: subSiteId }
      });
      
      return { success: true };
    } catch (e) {
      fastify.log.error({ error: e.message }, 'Error deleting subsite');
      reply.code(500);
      return { error: '删除子站点失败' };
    }
  });

  // 获取站点的模型价格信息
  fastify.get('/api/sites/:id/pricing', {
    schema: {
      params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] }
    }
  }, async (request, reply) => {
    const { id } = request.params;
    const currentUserId = request.user.sub;
    const { decrypt } = require('./crypto');
    
    try {
      const site = await prisma.site.findUnique({ where: { id } });
      if (!site) {
        reply.code(404);
        return { error: '站点不存在' };
      }
      
      // 验证站点所有权
      if (site.ownerId !== currentUserId) {
        reply.code(403);
        return { error: '无权限操作此站点' };
      }
      
      const token = site.apiKeyEnc ? decrypt(site.apiKeyEnc) : null;
      if (!token) {
        return { siteType: site.apiType || 'newapi' };
      }
      
      const baseUrl = site.baseUrl.replace(/\/$/, '');
      const siteType = site.apiType || 'newapi';
      
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };
      
      if (site.userId) {
        // 添加用户ID请求头
        headers['New-API-User'] = site.userId;
        headers['Veloera-User'] = site.userId;
        headers['User-id'] = site.userId;
      }
      
      console.log(`[PRICING-API] 站点类型: ${siteType}`);
      
      // 根据站点类型使用不同的API端点
      if (siteType === 'onehub' || siteType === 'donehub') {
        // OneHub/DoneHub: 需要同时请求两个端点
        const [modelRes, groupRes] = await Promise.all([
          fetch(`${baseUrl}/api/available_model`, {
            method: 'GET',
            headers,
            signal: AbortSignal.timeout(10000)
          }),
          fetch(`${baseUrl}/api/user_group_map`, {
            method: 'GET',
            headers,
            signal: AbortSignal.timeout(10000)
          })
        ]);
        
        console.log(`[PRICING-API] available_model状态码: ${modelRes.status}, user_group_map状态码: ${groupRes.status}`);
        
        if (!modelRes.ok) {
          const errorText = await modelRes.text();
          console.log(`[PRICING-API] available_model错误:`, errorText.substring(0, 200));
          return { siteType };
        }
        
        const modelData = await modelRes.json();
        const groupData = groupRes.ok ? await groupRes.json() : { data: {} };
        
        const modelCount = Object.keys(modelData.data || {}).length;
        console.log(`[PRICING-API] 模型数量: ${modelCount}`);
        
        if (modelCount > 0) {
          const firstModelKey = Object.keys(modelData.data)[0];
          const firstModel = modelData.data[firstModelKey];
          console.log(`[PRICING-API] 第一个模型示例 (${firstModelKey}):`, JSON.stringify(firstModel));
        }
        
        // 转换为统一格式（参考 all-api-hub 的 transformModelPricing）
        // OneHub 返回的是对象格式，需要转换为数组
        const dataArray = Object.entries(modelData.data || {}).map(([modelName, model]) => ({
          model_name: modelName,
          quota_type: model.price?.type === 'tokens' ? 0 : 1,
          model_ratio: 1,
          model_price: {
            input: model.price?.input || 0,
            output: model.price?.output || 0
          },
          owner_by: model.owned_by || '',
          completion_ratio: model.price?.output / model.price?.input || 1,
          enable_groups: model.groups?.length > 0 ? model.groups : ['default'],
          supported_endpoint_types: []
        }));
        
        // 转换 group_ratio
        const groupRatio = {};
        for (const [key, group] of Object.entries(groupData.data || {})) {
          groupRatio[key] = group.ratio || 1;
        }
        
        console.log(`[PRICING-API] 转换后的数据数量: ${dataArray.length}`);
        
        return {
          data: dataArray,
          group_ratio: groupRatio,
          siteType,
          success: true
        };
      } else {
        // NewAPI/Veloera/其他: 使用 /api/pricing
        const url = `${baseUrl}/api/pricing`;
        console.log(`[PRICING-API] 请求URL: ${url}`);
        
        const res = await fetch(url, { 
          method: 'GET',
          headers,
          signal: AbortSignal.timeout(10000)
        });
        
        console.log(`[PRICING-API] HTTP状态码: ${res.status}`);
        
        if (!res.ok) {
          const errorText = await res.text();
          console.log(`[PRICING-API] 错误响应:`, errorText.substring(0, 200));
          fastify.log.warn({ statusCode: res.status, url, error: errorText.substring(0, 100) }, 'Pricing API not available');
          return { siteType };
        }
        
        const rawText = await res.text();
        console.log(`[PRICING-API] 响应长度: ${rawText.length}`);
        
        const data = JSON.parse(rawText);
        console.log(`[PRICING-API] 解析后的数据键:`, Object.keys(data));
        
        // 在返回数据中添加站点类型信息
        return {
          ...data,
          siteType
        };
      }
    } catch (e) {
      console.log(`[PRICING-API] 异常:`, e.message);
      fastify.log.warn({ error: e.message, siteId: id, stack: e.stack }, 'Error fetching pricing');
      return { siteType: site.apiType || 'newapi' }; // 返回站点类型，即使出错
    }
  });

  // 代理获取站点令牌列表（避免跨域问题）
  fastify.get('/api/sites/:id/tokens', {
    schema: {
      params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] }
    }
  }, async (request, reply) => {
    const { id } = request.params;
    const currentUserId = request.user.sub;
    const { decrypt } = require('./crypto');
    
    try {
      const site = await prisma.site.findUnique({ where: { id } });
      if (!site) {
        reply.code(404);
        return { error: '站点不存在' };
      }
      
      // 验证站点所有权
      if (site.ownerId !== currentUserId) {
        reply.code(403);
        return { error: '无权限访问此站点' };
      }
      
      const token = site.apiKeyEnc ? decrypt(site.apiKeyEnc) : null;
      if (!token) {
        reply.code(400);
        return { error: '站点未配置API令牌' };
      }
      
      const baseUrl = site.baseUrl.replace(/\/$/, '');
      // 不传递分页参数，直接获取所有令牌
      const url = `${baseUrl}/api/token/`;
      
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };
      if (site.userId) {
        // 不同站点类型使用不同的用户ID请求头
        if (site.apiType === 'newapi') {
          headers['New-Api-User'] = site.userId;
        } else if (site.apiType === 'veloera') {
          headers['Veloera-User'] = site.userId;
        }
        // 其他类型不需要用户ID请求头
      }
      
      const res = await fetch(url, { headers });
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.message || '获取令牌列表失败');
      }
      
      return data;
    } catch (e) {
      fastify.log.error({ error: e.message, siteId: id }, 'Error fetching tokens');
      reply.code(500);
      return { error: e.message || '获取令牌列表失败' };
    }
  });
  
  // 代理获取站点分组列表
  fastify.get('/api/sites/:id/groups', {
    schema: {
      params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] }
    }
  }, async (request, reply) => {
    const { id } = request.params;
    const currentUserId = request.user.sub;
    const { decrypt } = require('./crypto');
    
    try {
      const site = await prisma.site.findUnique({ where: { id } });
      if (!site) {
        reply.code(404);
        return { error: '站点不存在' };
      }
      
      // 验证站点所有权
      if (site.ownerId !== currentUserId) {
        reply.code(403);
        return { error: '无权限访问此站点' };
      }
      
      const token = site.apiKeyEnc ? decrypt(site.apiKeyEnc) : null;
      if (!token) {
        reply.code(400);
        return { error: '站点未配置API令牌' };
      }
      
      const baseUrl = site.baseUrl.replace(/\/$/, '');
      let url = '';
      if (site.apiType === 'donehub') {
        url = `${baseUrl}/api/user_group_map`;
      } else {
        url = `${baseUrl}/api/user/self/groups`;
      }
      
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };
      if (site.userId) {
        // 不同站点类型使用不同的用户ID请求头
        if (site.apiType === 'newapi') {
          headers['New-Api-User'] = site.userId;
        } else if (site.apiType === 'veloera') {
          headers['Veloera-User'] = site.userId;
        }
        // 其他类型不需要用户ID请求头
      }
      
      const res = await fetch(url, { headers });
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.message || '获取分组列表失败');
      }
      
      return data;
    } catch (e) {
      fastify.log.error({ error: e.message, siteId: id }, 'Error fetching groups');
      reply.code(500);
      return { error: e.message || '获取分组列表失败' };
    }
  });
  
  // 代理创建站点令牌
  fastify.post('/api/sites/:id/tokens', {
    schema: {
      params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
      body: { type: 'object' }
    }
  }, async (request, reply) => {
    const { id } = request.params;
    const currentUserId = request.user.sub;
    const tokenData = request.body;
    const { decrypt } = require('./crypto');
    
    try {
      const site = await prisma.site.findUnique({ where: { id } });
      if (!site) {
        reply.code(404);
        return { error: '站点不存在' };
      }
      
      // 验证站点所有权
      if (site.ownerId !== currentUserId) {
        reply.code(403);
        return { error: '无权限操作此站点' };
      }
      
      const token = site.apiKeyEnc ? decrypt(site.apiKeyEnc) : null;
      if (!token) {
        reply.code(400);
        return { error: '站点未配置API令牌' };
      }
      
      const baseUrl = site.baseUrl.replace(/\/$/, '');
      const url = `${baseUrl}/api/token/`;
      
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };
      if (site.userId) {
        // 不同站点类型使用不同的用户ID请求头
        if (site.apiType === 'newapi') {
          headers['New-Api-User'] = site.userId;
        } else if (site.apiType === 'veloera') {
          headers['Veloera-User'] = site.userId;
        } else if (site.apiType === 'donehub') {
          headers['User-id'] = site.userId;
        }
      }
      
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(tokenData)
      });
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.message || '创建令牌失败');
      }
      
      return data;
    } catch (e) {
      fastify.log.error({ error: e.message, siteId: id }, 'Error creating token');
      reply.code(500);
      return { error: e.message || '创建令牌失败' };
    }
  });
  
  // 代理更新站点令牌
  fastify.put('/api/sites/:id/tokens', {
    schema: {
      params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
      body: { type: 'object' }
    }
  }, async (request, reply) => {
    const { id } = request.params;
    const currentUserId = request.user.sub;
    const tokenData = request.body;
    const { decrypt } = require('./crypto');
    
    try {
      const site = await prisma.site.findUnique({ where: { id } });
      if (!site) {
        reply.code(404);
        return { error: '站点不存在' };
      }
      
      // 验证站点所有权
      if (site.ownerId !== currentUserId) {
        reply.code(403);
        return { error: '无权限操作此站点' };
      }
      
      const token = site.apiKeyEnc ? decrypt(site.apiKeyEnc) : null;
      if (!token) {
        reply.code(400);
        return { error: '站点未配置API令牌' };
      }
      
      const baseUrl = site.baseUrl.replace(/\/$/, '');
      const url = `${baseUrl}/api/token/`;
      
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };
      if (site.userId) {
        // 不同站点类型使用不同的用户ID请求头
        if (site.apiType === 'newapi') {
          headers['New-Api-User'] = site.userId;
        } else if (site.apiType === 'veloera') {
          headers['Veloera-User'] = site.userId;
        }
        // 其他类型不需要用户ID请求头
      }
      
      const res = await fetch(url, {
        method: 'PUT',
        headers,
        body: JSON.stringify(tokenData)
      });
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.message || '更新令牌失败');
      }
      
      return data;
    } catch (e) {
      fastify.log.error({ error: e.message, siteId: id }, 'Error updating token');
      reply.code(500);
      return { error: e.message || '更新令牌失败' };
    }
  });
  
  // 代理删除站点令牌
  fastify.delete('/api/sites/:id/tokens/:tokenId', {
    schema: {
      params: { type: 'object', properties: { id: { type: 'string' }, tokenId: { type: 'number' } }, required: ['id', 'tokenId'] }
    }
  }, async (request, reply) => {
    const { id, tokenId } = request.params;
    const currentUserId = request.user.sub;
    const { decrypt } = require('./crypto');
    
    try {
      const site = await prisma.site.findUnique({ where: { id } });
      if (!site) {
        reply.code(404);
        return { error: '站点不存在' };
      }
      
      // 验证站点所有权
      if (site.ownerId !== currentUserId) {
        reply.code(403);
        return { error: '无权限操作此站点' };
      }
      
      const token = site.apiKeyEnc ? decrypt(site.apiKeyEnc) : null;
      if (!token) {
        reply.code(400);
        return { error: '站点未配置API令牌' };
      }
      
      const baseUrl = site.baseUrl.replace(/\/$/, '');
      const url = `${baseUrl}/api/token/${tokenId}`;
      
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };
      if (site.userId) {
        // 不同站点类型使用不同的用户ID请求头
        if (site.apiType === 'newapi') {
          headers['New-Api-User'] = site.userId;
        } else if (site.apiType === 'veloera') {
          headers['Veloera-User'] = site.userId;
        }
        // 其他类型不需要用户ID请求头
      }
      
      const res = await fetch(url, {
        method: 'DELETE',
        headers
      });
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.message || '删除令牌失败');
      }
      
      return data;
    } catch (e) {
      fastify.log.error({ error: e.message, siteId: id, tokenId }, 'Error deleting token');
      reply.code(500);
      return { error: e.message || '删除令牌失败' };
    }
  });

  // 代理兑换码请求
  fastify.post('/api/sites/:id/redeem', {
    schema: {
      params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
      body: { type: 'object', properties: { key: { type: 'string' } }, required: ['key'] }
    }
  }, async (request, reply) => {
    const { id } = request.params;
    const currentUserId = request.user.sub;
    const { key } = request.body;
    const { decrypt } = require('./crypto');
    
    try {
      const site = await prisma.site.findUnique({ where: { id } });
      if (!site) {
        reply.code(404);
        return { error: '站点不存在' };
      }
      
      // 验证站点所有权
      if (site.ownerId !== currentUserId) {
        reply.code(403);
        return { error: '无权限操作此站点' };
      }
      
      const token = site.apiKeyEnc ? decrypt(site.apiKeyEnc) : null;
      if (!token) {
        reply.code(400);
        return { error: '站点未配置API令牌' };
      }
      
      const baseUrl = site.baseUrl.replace(/\/$/, '');
      const url = `${baseUrl}/api/user/topup`;
      
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };
      if (site.userId) {
        // 不同站点类型使用不同的用户ID请求头
        if (site.apiType === 'newapi') {
          headers['New-Api-User'] = site.userId;
        } else if (site.apiType === 'veloera') {
          headers['Veloera-User'] = site.userId;
        }
        // 其他类型不需要用户ID请求头
      }
      
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ key })
      });
      const data = await res.json();
      
      // 直接返回站点API的响应
      return data;
    } catch (e) {
      fastify.log.error({ error: e.message, siteId: id, key }, 'Error redeeming code');
      reply.code(500);
      return { success: false, message: e.message || '兑换请求失败' };
    }
  });

  fastify.get('/api/sites/:id/diffs', {
    schema: {
      params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
      querystring: { type: 'object', properties: { limit: { type: 'number' } } },
    },
  }, async (request, reply) => {
    const { id } = request.params;
    const currentUserId = request.user.sub;
    const limit = Number(request.query?.limit || 50);
    
    // 验证站点所有权
    const site = await prisma.site.findUnique({ where: { id } });
    if (!site) {
      reply.code(404);
      return { error: '站点不存在' };
    }
    if (site.ownerId !== currentUserId) {
      reply.code(403);
      return { error: '无权限访问此站点数据' };
    }
    
    const diffs = await prisma.modelDiff.findMany({ where: { siteId: id }, orderBy: { diffAt: 'desc' }, take: limit });
    return diffs.map(d => ({
      ...d,
      addedJson: safeParse(d.addedJson, []),
      removedJson: safeParse(d.removedJson, []),
      changedJson: safeParse(d.changedJson, []),
    }));
  });

  fastify.get('/api/sites/:id/snapshots', {
    schema: {
      params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
      querystring: { type: 'object', properties: { limit: { type: 'number' } } },
    },
  }, async (request, reply) => {
    const { id } = request.params;
    const currentUserId = request.user.sub;
    const limit = Number(request.query?.limit || 1);
    
    // 验证站点所有权
    const site = await prisma.site.findUnique({ where: { id } });
    if (!site) {
      reply.code(404);
      return { error: '站点不存在' };
    }
    if (site.ownerId !== currentUserId) {
      reply.code(403);
      return { error: '无权限访问此站点数据' };
    }
    
    // 只返回成功的快照（用于显示当前模型列表）
    const snaps = await prisma.modelSnapshot.findMany({ 
      where: { siteId: id, errorMessage: null }, 
      orderBy: { fetchedAt: 'desc' }, 
      take: limit 
    });
    return snaps.map(s => ({ ...s, modelsJson: safeParse(s.modelsJson, []) }));
  });

  fastify.get('/api/sites/:id/latest-snapshot', {
    schema: {
      params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    },
  }, async (request, reply) => {
    const { id } = request.params;
    const currentUserId = request.user.sub;
    
    // 验证站点所有权
    const site = await prisma.site.findUnique({ where: { id } });
    if (!site) {
      reply.code(404);
      return { error: '站点不存在' };
    }
    if (site.ownerId !== currentUserId) {
      reply.code(403);
      return { error: '无权限访问此站点数据' };
    }
    
    const snap = await prisma.modelSnapshot.findFirst({
      where: { siteId: id },
      orderBy: { fetchedAt: 'desc' }
    });
    if (!snap) {
      return { error: '暂无快照数据' };
    }
    return {
      ...snap,
      modelsJson: safeParse(snap.modelsJson, [])
    };
  });

  // 邮件通知配置 API
  fastify.get('/api/email-config', async (request) => {
    const currentUserId = request.user.sub;
    const config = await prisma.emailConfig.findUnique({
      where: { ownerId: currentUserId }
    });
    if (!config) {
      return { enabled: false, notifyEmails: '', resendApiKeyEnc: null };
    }
    // 不返回加密的 API Key，只返回配置状态
    const { resendApiKeyEnc, ...rest } = config;
    return rest;
  });

  fastify.post('/api/email-config', {
    schema: {
      body: {
        type: 'object',
        required: ['resendApiKey', 'notifyEmails'],
        properties: {
          resendApiKey: { type: 'string', minLength: 1 },
          notifyEmails: { type: 'string', minLength: 1 },
          enabled: { type: 'boolean' }
        }
      }
    }
  }, async (request, reply) => {
    const currentUserId = request.user.sub;
    const { resendApiKey, notifyEmails, enabled = true } = request.body;
    
    // 验证邮箱格式
    const emails = notifyEmails.split(',').map(e => e.trim()).filter(Boolean);
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    for (const email of emails) {
      if (!emailRegex.test(email)) {
        return reply.code(400).send({ error: `邮箱格式不正确：${email}` });
      }
    }
    
    // 加密 API Key
    const resendApiKeyEnc = encrypt(resendApiKey);
    
    // 检查当前用户是否已存在配置
    const existing = await prisma.emailConfig.findUnique({
      where: { ownerId: currentUserId }
    });
    
    let config;
    if (existing) {
      // 更新现有配置
      config = await prisma.emailConfig.update({
        where: { id: existing.id },
        data: { resendApiKeyEnc, notifyEmails, enabled }
      });
    } else {
      // 创建新配置
      config = await prisma.emailConfig.create({
        data: { 
          ownerId: currentUserId,
          resendApiKeyEnc, 
          notifyEmails, 
          enabled 
        }
      });
    }
    
    const { resendApiKeyEnc: _, ...rest } = config;
    return rest;
  });

  // 定时检测配置路由
  fastify.get('/api/schedule-config', getScheduleConfigHandler);
  
  fastify.post('/api/schedule-config', {
    schema: {
      body: {
        type: 'object',
        required: ['enabled', 'hour', 'minute', 'interval'],
        properties: {
          enabled: { type: 'boolean' },
          hour: { type: 'number', minimum: 0, maximum: 23 },
          minute: { type: 'number', minimum: 0, maximum: 59 },
          interval: { type: 'number', minimum: 10, maximum: 300 },
          overrideIndividual: { type: 'boolean' }
        }
      }
    }
  }, updateScheduleConfigHandler);

  // 分类管理路由
  fastify.get('/api/categories', async (request) => {
    const currentUserId = request.user.sub;
    const categories = await prisma.category.findMany({ 
      where: { ownerId: currentUserId },
      orderBy: { createdAt: 'asc' },
      include: { sites: true }
    });
    return categories;
  });

  fastify.post('/api/categories', {
    schema: {
      body: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', minLength: 1 },
          scheduleCron: { type: 'string' },
          timezone: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    const currentUserId = request.user.sub;
    const { name, scheduleCron = null, timezone = 'Asia/Shanghai' } = request.body;
    
    try {
      const category = await prisma.category.create({
        data: { 
          ownerId: currentUserId,
          name, 
          scheduleCron, 
          timezone 
        }
      });
      return category;
    } catch (e) {
      if (e.code === 'P2002') {
        return reply.code(400).send({ error: '分类名称已存在' });
      }
      throw e;
    }
  });

  fastify.patch('/api/categories/:id', {
    schema: {
      params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
      body: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          scheduleCron: { type: 'string' },
          timezone: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    const { id } = request.params;
    const currentUserId = request.user.sub;
    const data = {};
    const { name, scheduleCron, timezone } = request.body || {};
    
    // 验证分类所有权
    const category = await prisma.category.findUnique({ where: { id } });
    if (!category) {
      reply.code(404);
      return { error: '分类不存在' };
    }
    if (category.ownerId !== currentUserId) {
      reply.code(403);
      return { error: '无权限修改此分类' };
    }
    
    if (name) data.name = name;
    if (scheduleCron !== undefined) data.scheduleCron = scheduleCron;
    if (timezone) data.timezone = timezone;
    
    try {
      const updatedCategory = await prisma.category.update({ where: { id }, data });
      return updatedCategory;
    } catch (e) {
      if (e.code === 'P2002') {
        return reply.code(400).send({ error: '分类名称已存在' });
      }
      if (e.code === 'P2025') {
        return reply.code(404).send({ error: '分类不存在' });
      }
      throw e;
    }
  });

  fastify.delete('/api/categories/:id', {
    schema: { params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } }
  }, async (request, reply) => {
    const { id } = request.params;
    const currentUserId = request.user.sub;
    
    // 验证分类所有权
    const category = await prisma.category.findUnique({ where: { id } });
    if (!category) {
      reply.code(404);
      return { error: '分类不存在' };
    }
    if (category.ownerId !== currentUserId) {
      reply.code(403);
      return { error: '无权限删除此分类' };
    }
    
    try {
      // 将该分类下的所有站点的categoryId设为null（归入未分类）
      await prisma.site.updateMany({
        where: { categoryId: id, ownerId: currentUserId },
        data: { categoryId: null }
      });
      
      // 删除分类
      await prisma.category.delete({ where: { id } });
      return { ok: true };
    } catch (e) {
      if (e.code === 'P2025') {
        return reply.code(404).send({ error: '分类不存在' });
      }
      throw e;
    }
  });

  // 分类一键检测
  fastify.post('/api/categories/:id/check', {
    schema: { 
      params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
      querystring: { type: 'object', properties: { skipNotification: { type: 'string' } } }
    }
  }, async (request, reply) => {
    const { id } = request.params;
    const currentUserId = request.user.sub;
    const skipNotification = request.query?.skipNotification === 'true';
    
    // 验证分类所有权
    const category = await prisma.category.findUnique({ where: { id } });
    if (!category) {
      reply.code(404);
      return { error: '分类不存在' };
    }
    if (category.ownerId !== currentUserId) {
      reply.code(403);
      return { error: '无权限检测此分类' };
    }
    
    // 获取该分类下的所有站点（不包括置顶和排除一键检测的站点）
    const sites = await prisma.site.findMany({
      where: { 
        categoryId: id,
        ownerId: currentUserId,
        pinned: false,
        excludeFromBatch: false
      }
    });
    
    if (sites.length === 0) {
      return reply.code(400).send({ error: '该分类下没有可检测的站点' });
    }
    
    const results = {
      changes: [],
      failures: [],
      totalSites: sites.length
    };
    
    // 依次检测每个站点（5秒间隔）
    for (let i = 0; i < sites.length; i++) {
      const site = sites[i];
      try {
        const result = await checkSiteById(site.id, fastify, { skipNotification, isManual: true });
        if (result.hasChanges && result.diff) {
          results.changes.push({
            siteName: site.name,
            diff: result.diff
          });
        }
      } catch (e) {
        results.failures.push({
          siteName: site.name,
          error: e.message || '检测失败'
        });
      }
      
      // 如果不是最后一个站点，等待5秒
      if (i < sites.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
    
    return { ok: true, results };
  });
}

module.exports = { routes };

// 定时配置处理器
async function getScheduleConfigHandler(request, reply) {
  try {
    const currentUserId = request.user.sub;
    let config = await prisma.scheduleConfig.findUnique({
      where: { ownerId: currentUserId }
    });
    if (!config) {
      // 创建默认配置
      config = await prisma.scheduleConfig.create({
        data: {
          ownerId: currentUserId,
          enabled: false,
          hour: 9,
          minute: 0,
          timezone: 'Asia/Shanghai',
          interval: 30
        }
      });
    }
    return { ok: true, config };
  } catch (error) {
    reply.log.error(error);
    return reply.status(500).send({ ok: false, error: '获取定时配置失败' });
  }
}

async function updateScheduleConfigHandler(request, reply) {
  try {
    const currentUserId = request.user.sub;
    const { enabled, hour, minute, interval, overrideIndividual } = request.body;
    
    // 验证参数
    if (typeof enabled !== 'boolean' || 
        typeof hour !== 'number' || hour < 0 || hour > 23 ||
        typeof minute !== 'number' || minute < 0 || minute > 59 ||
        typeof interval !== 'number' || interval < 5 || interval > 300) {
      return reply.status(400).send({ 
        ok: false, 
        error: '参数无效：hour(0-23), minute(0-59), interval(5-300秒)' 
      });
    }

    // 查找当前用户的配置
    let config = await prisma.scheduleConfig.findUnique({
      where: { ownerId: currentUserId }
    });
    
    const updateData = { 
      enabled, 
      hour, 
      minute, 
      interval, 
      overrideIndividual: overrideIndividual === true,
      updatedAt: new Date() 
    };
    
    if (config) {
      // 更新现有配置
      config = await prisma.scheduleConfig.update({
        where: { id: config.id },
        data: updateData
      });
    } else {
      // 创建新配置
      config = await prisma.scheduleConfig.create({
        data: { 
          ownerId: currentUserId,
          ...updateData, 
          timezone: 'Asia/Shanghai' 
        }
      });
    }

    // 重新配置定时任务
    await scheduleGlobalTask(config, reply.server);

    return { ok: true, config };
  } catch (error) {
    reply.log.error(error);
    return reply.status(500).send({ ok: false, error: '更新定时配置失败' });
  }
}

function safeParse(s, def) {
  try { return JSON.parse(s) } catch (_) { return def }
}
