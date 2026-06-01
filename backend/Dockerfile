FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

RUN apk add --no-cache python3 py3-pip

RUN pip3 install --break-system-packages yt-dlp

RUN npm ci --only=production

COPY . .

CMD ["npm", "start"]