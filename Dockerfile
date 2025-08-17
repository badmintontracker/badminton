# Use Node.js official image
FROM node:20-alpine

# Create app directory
WORKDIR /app

# Copy backend and frontend
COPY backend/ ./backend/
COPY frontend/ ./frontend/

# Install backend dependencies
WORKDIR /app/backend
RUN npm install express sqlite3 body-parser cors

# Set environment variable for port
ENV PORT=8080

# Expose port 8080
EXPOSE 8080

# Start server
CMD ["node", "server.js"]
