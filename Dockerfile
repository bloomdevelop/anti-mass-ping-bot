FROM ubuntu:latest
RUN apt-get update  -y
RUN apt-get upgrade -y
RUN apt-get install -y sqlite3 libsqlite3-dev git curl nodejs npm
RUN npm install -g pnpm
WORKDIR /app
COPY . .
RUN pnpm i -f
CMD ["pnpm", "start"]
