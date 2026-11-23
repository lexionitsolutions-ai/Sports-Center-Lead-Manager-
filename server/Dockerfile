FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY server ./server
USER node
EXPOSE 8787
CMD ["node", "server/index.js"]
