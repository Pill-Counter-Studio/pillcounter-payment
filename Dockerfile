FROM node:14.20.1-alpine AS deps
WORKDIR /app
COPY package.json .
COPY package-lock.json .
RUN npm install

FROM node:14.20.1-alpine AS builder
WORKDIR /app
COPY src .
COPY tsconfig.json .
COPY package.json .
COPY --from=deps /app/node_modules ./node_modules
RUN npm run build

FROM node:14.20.1-alpine AS runner
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

EXPOSE 3002
CMD ["npm", "start"]