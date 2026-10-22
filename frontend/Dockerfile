# Stage 1: Build the React application
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency definitions and install
COPY package.json package-lock.json ./
RUN npm ci

# Copy frontend source and build
COPY . .
RUN npm run build

# Stage 2: Serve built assets using high-performance Nginx
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
