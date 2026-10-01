FROM mcr.microsoft.com/playwright:v1.63.0-noble
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --ignore-scripts
COPY server.cjs ./
ENV PORT=8080
EXPOSE 8080
CMD ["node","server.cjs"]
