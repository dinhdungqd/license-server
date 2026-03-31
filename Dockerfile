FROM node:20-alpine
WORKDIR /app
COPY . .
EXPOSE 7979
CMD ["node", "server.js"]
