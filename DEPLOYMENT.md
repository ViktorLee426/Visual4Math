# Visual4Math Deployment Guide

This guide explains how to deploy the Visual4Math web application to the lab's server following the ITC handbook.

## Prerequisites

1. **Access to server**: SSH access to `peachlab-cntr1.inf.ethz.ch`
2. **GitHub access**: Ability to push Docker images to GitHub Container Registry (GHCR)
3. **Domain setup**: Request domain `visual4math.peachhub-cntr1.inf.ethz.ch` from ISG if not already available
   - Modify subdomains: https://www.isg.inf.ethz.ch/Main/ServicesNetworkITCoordinatorsDNSModifyIP?ip=129.132.15.76

## Architecture Notes

- **Server**: RedHat 9 (AMD64 architecture)
- **Local development**: Apple Silicon (ARM64)
- **Python version**: 3.13
- **Node.js version**: 20.x
- **Docker platform**: Must build for `linux/amd64` for server compatibility

## Step 1: Request Domain (if needed)

According to the handbook, existing domains (alpha, beta, gamma, delta, epsilon) may be taken. Contact ISG to request the `visual4math` subdomain or use an available one.

## Step 2: Build and Push Docker Image (Local Machine)

**Important**: You must build for AMD64 platform since the server is RedHat 9 (x86_64), but you're developing on Apple Silicon (ARM64).

```bash
# 1. Login to GitHub Container Registry
# You'll need a GitHub personal access token with 'write:packages' permission
echo <your_github_token> | docker login ghcr.io -u <your_github_username> --password-stdin

# 2. Build the image for AMD64 platform (required for server)
docker build --platform linux/amd64 -t visual4math:latest .

# 3. Tag the image for GHCR
docker tag visual4math:latest ghcr.io/eth-peach-lab/visual4math:latest

# 4. Push to GHCR
docker push ghcr.io/eth-peach-lab/visual4math:latest
```

## Step 3: Deploy on Server

```bash
# 1. SSH into the server
ssh <your_eth_username>@peachlab-cntr1.inf.ethz.ch

# 2. Navigate to containers directory
cd /opt/containers

# 3. Create project folder
mkdir visual4math
cd visual4math

# 4. Create .env file with your secrets
nano .env
```

Add the following to `.env`:
```bash
OPENAI_API_KEY=your_actual_openai_api_key_here
```

**Note**: Other environment variables (DATA_FILE_PATH, CACHE_DIR, ALLOWED_ORIGINS) are set in `docker-compose.yml`, but you can override them in `.env` if needed.

```bash
# 5. Copy docker-compose.yml from your local machine to server
# (You can use scp or copy-paste the content)
scp docker-compose.yml <your_eth_username>@peachlab-cntr1.inf.ethz.ch:/opt/containers/visual4math/

# Or create it directly on server:
nano docker-compose.yml
# Paste the content from the docker-compose.yml file in the repo

# 6. Login to GHCR on server
docker login ghcr.io

# 7. Pull the image
docker pull ghcr.io/eth-peach-lab/visual4math:latest

# 8. Create data directories with proper permissions
sudo mkdir -p /var/lib/peachlab/data/visual4math/data
sudo mkdir -p /var/lib/peachlab/data/visual4math/cached_images
sudo chown -R $USER:$USER /var/lib/peachlab/data/visual4math

# 9. Start the container
docker compose -f docker-compose.yml up -d

# 10. Check logs to verify it's running
docker compose -f docker-compose.yml logs -f
```

## Step 4: Verify Deployment

1. **Check container status**:
   ```bash
   docker ps | grep visual4math
   ```

2. **Visit the application**:
   - URL: `https://visual4math.peachhub-cntr1.inf.ethz.ch/`
   - API docs: `https://visual4math.peachhub-cntr1.inf.ethz.ch/docs`

3. **Check nginx-proxy logs** (if issues):
   ```bash
   docker logs nginx-proxy
   ```

4. **Verify HTTPS certificate**: Let's Encrypt should automatically generate the SSL certificate via nginx-proxy.

## Environment Variables

### Required in `.env` file:
- `OPENAI_API_KEY`: Your OpenAI API key

### Set in `docker-compose.yml`:
- `VIRTUAL_HOST`: Domain name for nginx-proxy
- `VIRTUAL_PORT`: Port the app runs on (8000)
- `LETSENCRYPT_HOST`: Domain for SSL certificate
- `LETSENCRYPT_EMAIL`: Email for Let's Encrypt (update if different from wangjun@ethz.ch)
- `DATA_FILE_PATH`: Path to data file (`/app/data/simple_data.json`)
- `CACHE_DIR`: Path to image cache directory (`/app/cached_images`)
- `ALLOWED_ORIGINS`: CORS allowed origins (production domain)

## Data Persistence

Data is stored in persistent volumes:
- **Research data**: `/var/lib/peachlab/data/visual4math/data/simple_data.json`
- **Cached images**: `/var/lib/peachlab/data/visual4math/cached_images/`

These directories persist even if the container is recreated.

## Automatic Updates

The container is configured with Watchtower labels, so it will automatically pull and deploy new images when you push updates to GHCR. Watchtower checks for updates every 24 hours by default.

To manually trigger an update:
```bash
# On server
docker compose -f docker-compose.yml pull
docker compose -f docker-compose.yml up -d
```

## Troubleshooting

### Container won't start
- Check logs: `docker compose -f docker-compose.yml logs`
- Verify environment variables are set correctly
- Check that data directories exist and have correct permissions

### Domain not accessible
- Verify domain is configured in DNS (contact ISG)
- Check nginx-proxy logs: `docker logs nginx-proxy`
- Verify VIRTUAL_HOST and LETSENCRYPT_HOST match your domain

### CORS errors
- Verify ALLOWED_ORIGINS includes your production domain
- Check that the domain matches exactly (including https://)

### Data not persisting
- Verify volumes are mounted correctly: `docker inspect visual4math | grep Mounts`
- Check directory permissions: `ls -la /var/lib/peachlab/data/visual4math/`

## Updating the Application

1. **Make code changes locally**
2. **Build and push new image** (Step 2 above)
3. **On server, pull and restart**:
   ```bash
   docker compose -f docker-compose.yml pull
   docker compose -f docker-compose.yml up -d
   ```

Or wait for Watchtower to automatically update (within 24 hours).

## File Structure on Server

```
/opt/containers/visual4math/
  ├── docker-compose.yml  # Docker compose configuration
  └── .env                # Environment variables (secrets)

/var/lib/peachlab/data/visual4math/
  ├── data/
  │   └── simple_data.json  # Research data
  └── cached_images/        # Cached images
```

## Notes

- The Dockerfile builds for both Python 3.13 and Node.js 20.x
- The application runs on port 8000 inside the container
- nginx-proxy handles HTTPS and routes traffic to the container
- All data is persisted in `/var/lib/peachlab/data/visual4math/`
- The container automatically restarts on failure (`restart: always`)

