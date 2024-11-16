# Build the application
# -> transpile TypeScript to JavaScript
FROM node:22 AS builder

WORKDIR /usr/src/app

# Copy essential files for dependency installation
COPY package.json ./
COPY yarn.lock ./
COPY .yarnrc.yml ./

# Enable Corepack and use the required Yarn version
RUN corepack enable
RUN corepack prepare yarn@4.5.1 --activate

# Install dependencies and build the project
COPY tsconfig.json ./
COPY ./app ./app
RUN yarn install && yarn build

# Application runner
# -> Runs the transpiled code itself
# Separated from builder context to keep the image as slim as possible
FROM node:22

WORKDIR /app
ENV NODE_ENV=production

# Enable Corepack in the runtime image
RUN corepack enable
RUN corepack prepare yarn@4.5.1 --activate

# Copy essential files and built artifacts
COPY package.json ./
COPY yarn.lock ./
COPY .yarnrc.yml ./
COPY --from=builder /usr/src/app/dist/app ./app

EXPOSE 3000
CMD ["node", "app/launch.js"]

LABEL \
  org.opencontainers.image.vendor="AlsaceTeam" \
  org.opencontainers.image.title="Arkitektonika" \
  org.opencontainers.image.description="A REST repository for NBT data for Minecraft" \
  org.opencontainers.image.url="https://github.com/IntellectualSites" \
  org.opencontainers.image.source="https://github.com/IntellectualSites/Arkitektonika" \
  org.opencontainers.image.licenses="ISC" \
  com.docker.image.source.entrypoint=Dockerfile
