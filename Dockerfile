# Use Node.js official image
FROM node:20-alpine

# Create app directory
WORKDIR /app

# Copy backend and frontend into the container
COPY backend/ ./backend/
COPY frontend/ ./frontend/

# Install backend dependencies (use package.json if available)
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm install --production || npm install express sqlite3 body-parser cors

# Set environment variable for port
ENV PORT=8080

# Expose port 8080
EXPOSE 8080

# Start backend server (it will also serve frontend)
CMD ["node", "server.js"]
