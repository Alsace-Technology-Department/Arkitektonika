# Build the application
# -> transpile typescript to javascript
FROM node:22 AS builder

WORKDIR /usr/src/app

COPY package.json ./
COPY tsconfig.json ./
COPY yarn.lock ./
COPY .yarnrc.yml ./
COPY ./app ./app
RUN yarn install ; yarn build

# Application runner
# -> runs the transpiled code itself
# seperated from builder context to keep image as slim as possible
FROM node:22

WORKDIR /app
ENV NODE_ENV=production

COPY package.json ./
COPY yarn.lock ./
COPY .yarnrc.yml ./
RUN yarn install --only=production
COPY --from=builder /usr/src/app/dist/app ./app

EXPOSE 3000
CMD [ "node", "app/launch.js" ]

LABEL \
  org.opencontainers.image.vendor="AlsaceTeam" \
  org.opencontainers.image.title="Arkitektonika" \
  org.opencontainers.image.description="A REST repository for NBT data for Minecraft" \
  org.opencontainers.image.url="https://github.com/IntellectualSites" \
  org.opencontainers.image.source="https://github.com/IntellectualSites/Arkitektonika" \
  org.opencontainers.image.licenses="ISC" \
  com.docker.image.source.entrypoint=Dockerfile
