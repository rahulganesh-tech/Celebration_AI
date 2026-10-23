# Celebration AI — zero-dependency Node server, same deploy shape as ThunAI.
FROM node:20-slim
WORKDIR /app
COPY package.json ./
COPY server ./server
COPY public ./public
ENV PORT=8080
EXPOSE 8080
CMD ["node", "server/index.js"]
