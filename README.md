# Proximity Backend

This is the backend for the Proximity chat application. It provides:

- **User authentication** (JWT-based, with access and refresh tokens)
- **REST API** for registration, login, chatroom management, and message retrieval
- **Real-time chat** using socket.io for joining rooms, sending/receiving messages, and user presence
- **Prisma ORM** for database access (PostgreSQL)
- **Modular code structure** for controllers, services, middleware, and websocket events

## Main Features

- Register and log in users securely
- Create, list, and join chatrooms
- Send and receive messages in real time
- Retrieve last 50 messages for any chatroom
- User presence notifications (join/leave)

## Technologies Used
- Node.js + Express
- TypeScript
- Prisma ORM
- PostgreSQL
- socket.io
- JWT (jsonwebtoken)

## Key Endpoints

### REST API
- `POST /api/auth/register` — Register a new user
- `POST /api/auth/login` — Log in and receive tokens
- `POST /api/auth/refresh` — Refresh access token
- `GET /api/chatroom` — List chatrooms
- `POST /api/chatroom` — Create a chatroom
- `GET /api/chatroom/:id/messages` — Get last 50 messages

### WebSocket (socket.io)
- `joinRoom` — Join a chatroom
- `sendMessage` — Send a message
- `receiveMessage` — Receive a message
- `userJoined` / `userLeft` — User presence events

## Setup
1. Install dependencies: `npm install`
2. Set up your `.env` file (see `.env.example`)
3. Run database migrations: `npx prisma migrate dev`
4. Start the server: `npm run dev`

## More Info
- See `backend/WEBSOCKET_API.md` for full WebSocket and REST API documentation.
- Frontend should use socket.io-client for real-time features.

---

For questions, contact the backend developer or see the code for details.
