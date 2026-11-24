FROM node:20-alpine

WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Install all dependencies (including devDependencies so tests can run inside container if desired)
RUN npm install

# Copy application source code and tests
COPY . .

# Expose backend port
EXPOSE 3000

# Set default environment variables
ENV PORT=3000

# Run the backend server
CMD ["npm", "start"]
