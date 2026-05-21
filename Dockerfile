FROM node:20-alpine

WORKDIR /app

# Copy package.json and install dependencies
COPY package*.json ./
RUN npm install

# Copy application source
COPY . .

# Expose the server port
EXPOSE 3000

# Start the application in development mode
CMD ["npm", "run", "dev"]
