FROM ubuntu:latest
RUN apt-get update  -y
RUN apt-get upgrade -y
RUN apt-get install -y sqlite3 libsqlite3-dev git curl nodejs npm
RUN npm install -g pnpm
WORKDIR /app
COPY . .
RUN pnpm i -f
# IMPORTANT
# Yeah seriously, without this command the bot won't work
RUN pnpm sqlite3:create
CMD ["pnpm", "start"]
