import request from 'supertest';
import express from 'express';
import authRouter from '../../routes/auth';
import userRouter from '../../routes/user';
import chatRoomRouter from '../../routes/chatRoom';
import prisma from '../../utils/prisma';
import { genAccessTokenFromUser } from '../../services/authService';
import { ChatRoomMessage, User } from '@prisma/client';

const flushPromises = () => new Promise(process.nextTick);

describe('Integration Tests: Auth, User, ChatRoom', () => {
  let app: express.Express;
  let user: User;
  let adminUser: User;
  let accessToken: string;
  let adminToken: string;

  beforeAll(async () => {
    const { execSync } = require('child_process');
    execSync('npx prisma migrate reset --force --skip-seed --skip-generate', { stdio: 'inherit' });
  });

  beforeEach(async () => {
    app = express();
    app.use(express.json());
    app.use('/auth', authRouter);
    app.use('/user', userRouter);
    app.use('/chat', chatRoomRouter);
    await prisma.chatRoomMessage.deleteMany({});
    await prisma.chatRoom.deleteMany({});
    await prisma.user.deleteMany({});
    user = await prisma.user.create({
      data: {
        email: 'user@example.com',
        displayId: 'user',
        password: 'userpass',
        isAdmin: false,
        deleted: false,
      },
    });
    adminUser = await prisma.user.create({
      data: {
        email: 'admin@example.com',
        displayId: 'admin',
        password: 'adminpass',
        isAdmin: true,
        deleted: false,
      },
    });
    accessToken = await genAccessTokenFromUser(user);
    adminToken = await genAccessTokenFromUser(adminUser);
    await flushPromises();
  });

  afterAll(async () => {
    await prisma.chatRoomMessage.deleteMany({});
    await prisma.chatRoom.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.$disconnect();
    await flushPromises();
  });

  // --- Auth Tests ---
  it('should register a new user', async () => {
    await prisma.user.deleteMany({});
    const res = await request(app)
      .post('/auth/register')
      .send({ email: 'shoulduser@example.com', displayId: 'shoulduser', password: 'shouldpass123' });
    await flushPromises();
    expect(res.statusCode).toBe(201);
    expect(res.body).toMatchObject({
      message: 'User registered successfully',
      user: {
        id: expect.any(Number),
        email: 'shoulduser@example.com',
        displayId: 'shoulduser',
      },
    });
  });

  it('should login with correct credentials', async () => {
    await request(app)
      .post('/auth/register')
      .send({ email: 'shouldlogin@example.com', displayId: 'shouldlogin', password: 'shouldpass123' });
    await flushPromises();
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'shouldlogin@example.com', password: 'shouldpass123' });
    await flushPromises();
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('accessToken');
    expect(res.body).toHaveProperty('refreshToken');
  });

  it('should refresh token', async () => {
    await request(app)
      .post('/auth/register')
      .send({ email: 'shouldrefresh@example.com', displayId: 'shouldrefresh', password: 'shouldpass123' });
    await flushPromises();
    const loginRes = await request(app)
      .post('/auth/login')
      .send({ email: 'shouldrefresh@example.com', password: 'shouldpass123' });
    await flushPromises();
    const refreshToken = loginRes.body.refreshToken;
    const res = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken });
    await flushPromises();
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('accessToken');
  });

  // --- User Controller Tests ---
  it('should change username for self', async () => {
    const res = await request(app)
      .post('/user/changeUsername')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ newUserName: 'newuser' });
    await flushPromises();
    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty('message');
    const updated = await prisma.user.findUnique({ where: { id: user.id } });
    expect(updated?.displayId).toBe('newuser');
  });

  it('should not allow duplicate username', async () => {
    const res = await request(app)
      .post('/user/changeUsername')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ newUserName: 'admin' });
    await flushPromises();
    expect(res.statusCode).toBe(409);
    expect(res.body).toHaveProperty('message', 'Username already in use');
  });

  it('should delete self as user', async () => {
    console.log('Attempting to delete user:', user);
    const res = await request(app)
      .post('/user/delete')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ userId: user.id });
    await flushPromises();
    console.log('Delete response:', res.statusCode, res.body);
    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty('message');
    const deleted = await prisma.user.findUnique({ where: { id: user.id } });
    console.log('Deleted user record:', deleted);
    expect(deleted?.deleted).toBe(true);
  });

  it('should allow admin to delete another user', async () => {
    console.log('Admin attempting to delete user:', user);
    const res = await request(app)
      .post('/user/delete')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ userId: user.id });
    await flushPromises();
    console.log('Delete response:', res.statusCode, res.body);
    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty('message');
    const deleted = await prisma.user.findUnique({ where: { id: user.id } });
    console.log('Deleted user record:', deleted);
    expect(deleted?.deleted).toBe(true);
  });

  // --- Chat Room Controller Tests ---
  it('should create a new chat room', async () => {
    const res = await request(app)
      .post('/chat/create')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'ShouldRoom' });
    await flushPromises();
    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty('message');
    expect(res.body).toHaveProperty('chatRoomList');
    expect(res.body.chatRoomList.some((room: { name: string }) => room.name === 'ShouldRoom')).toBe(true);
  });

  it('should list chat rooms', async () => {
    await request(app)
      .post('/chat/create')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'ShouldListRoom' });
    await flushPromises();
    const res = await request(app)
      .get('/chat/list')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.some((room: { name: string }) => room.name === 'ShouldListRoom')).toBe(true);
  });

  it('should delete a chat room', async () => {
    const createRes = await request(app)
      .post('/chat/create')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'ShouldDeleteRoom' });
    await flushPromises();
    const chatRoomList = createRes.body.chatRoomList;
    const roomToDelete = chatRoomList.find((room: { name: string }) => room.name === 'ShouldDeleteRoom');
    expect(roomToDelete).toBeDefined();

    const res = await request(app)
      .post('/chat/delete')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ id: roomToDelete.id });
    await flushPromises();
    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty('message');
    expect(res.body).toHaveProperty('chatRoomList');
    expect(res.body.chatRoomList.some((room: { id: number }) => room.id === roomToDelete.id)).toBe(false);
  });
});
