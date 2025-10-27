const bcrypt = require('bcryptjs');
const fp = require('fastify-plugin');
const { prisma } = require('./db');
const { CONFIG } = require('./config');

const authPlugin = fp(async function (fastify) {
  await fastify.register(require('@fastify/jwt'), { secret: CONFIG.JWT_SECRET });

  fastify.decorate('auth', {
    async verify(request, reply) {
      try {
        await request.jwtVerify();
      } catch (err) {
        return reply.code(401).send({ error: '未授权访问，请重新登录' });
      }
    },
  });

  // 注册接口
  fastify.post('/api/auth/register', {
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 6 },
        },
      },
    },
  }, async (request, reply) => {
    const { email, password } = request.body;
    
    // 检查邮箱是否已存在
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return reply.code(400).send({ error: '该邮箱已被注册' });
    }
    
    // 密码长度检查
    if (password.length < 6) {
      return reply.code(400).send({ error: '密码长度至少为6位' });
    }
    
    // 检查是否是第一个用户，第一个用户自动成为管理员
    const userCount = await prisma.user.count();
    const isFirstUser = userCount === 0;
    
    // 创建新用户
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { 
        email, 
        passwordHash, 
        isAdmin: isFirstUser // 第一个注册的用户自动成为管理员
      },
    });
    
    // 生成token
    const token = fastify.jwt.sign({ sub: user.id, email: user.email, isAdmin: user.isAdmin }, { expiresIn: '7d' });
    
    if (isFirstUser) {
      fastify.log.info({ email }, '首位用户注册成功，已设置为管理员');
    } else {
      fastify.log.info({ email }, '新用户注册成功');
    }
    
    return { token, message: isFirstUser ? '注册成功！您是第一位用户，已获得管理员权限' : '注册成功' };
  });

  // 登录接口
  fastify.post('/api/auth/login', {
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 1 },
        },
      },
    },
  }, async (request, reply) => {
    const { email, password } = request.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return reply.code(401).send({ error: '邮箱或密码错误' });
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return reply.code(401).send({ error: '邮箱或密码错误' });
    const token = fastify.jwt.sign({ sub: user.id, email: user.email, isAdmin: user.isAdmin }, { expiresIn: '7d' });
    return { token };
  });
});

module.exports = { authPlugin };
