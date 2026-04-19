# Assemblyline 4 - Offline Self-Hosted Setup

Assemblyline 4 is composed of dozens of interconnected services, relying on multiple config files, policies, and environment variables. As such, it cannot be run from a single `docker-compose` file without compromising functionality and scale.

To run Assemblyline 4 in a strictly **offline/air-gapped environment**, you must first prepare an offline bundle on an internet-connected machine, and then transfer that bundle to your offline host.

## Prerequisites
- **Online Machine**: Internet access, Docker, Docker Compose, Git, OpenSSL.
- **Offline Machine**: Docker, Docker Compose, and adequate hardware resources.
- A method to transfer large files (USB, secure network transfer, etc.) between the two machines.

---

## Phase 1: Online Preparation (Download and Package)

On a machine WITH internet access, run the `pack-online.sh` script or follow these manual steps:

1. **Clone the official CCCS docker-compose repository:**
   ```bash
   git clone https://github.com/CybercentreCanada/assemblyline-docker-compose.git al4-local
   cd al4-local
   ```

2. **Generate a self-signed certificate for local UI HTTPS endpoints:**
   ```bash
   openssl req -nodes -x509 -newkey rsa:4096 -keyout config/nginx.key -out config/nginx.crt -days 365 -subj "/C=CA/ST=Ontario/L=Ottawa/O=CCCS/CN=assemblyline.local"
   ```

3. **Pull all pre-built images:**
   ```bash
   docker compose pull --ignore-buildable
   docker compose -f bootstrap-compose.yaml pull
   ```

4. **Build necessary dependent containers:**
   ```bash
   env COMPOSE_BAKE=true docker compose build
   ```

5. **Export the required Docker images locally:**
   ```bash
   # Save all local images into a tarball
   docker save $(docker images -q) -o ../al4-images.tar
   ```

6. **Create the final offline bundle:**
   ```bash
   cd ..
   tar -czvf al4-offline-bundle.tar.gz al4-local/ al4-images.tar
   ```

---

## Phase 2: Offline Deployment

Transfer the `al4-offline-bundle.tar.gz` to your **offline machine**, along with the deployment script `deploy-offline.sh` and the playbook `deploy-offline.yml`. Ensure you have administrative privileges.

### Option A: Automated Deployment via Script
Use the provided `deploy-offline.sh` wrapper script to automatically detect your environment (Ubuntu 24.04 LTS or RHEL 9.x), ensure Ansible is installed, and run the `deploy-offline.yml` playbook:

```bash
chmod +x deploy-offline.sh
./deploy-offline.sh
```

> **Note:** If your offline machine is strictly air-gapped without access to local repository mirrors (e.g., Satellite or local Apt mirrors) to install Ansible, the automated script may fail. In that case, proceed with **Option B**.

### Option B: Manual Steps (Air-gapped natively)

1. **Extract the bundle:**
   ```bash
   tar -xzvf al4-offline-bundle.tar.gz
   ```

2. **Increase the VM map count (required for Elasticsearch to function):**
   ```bash
   sudo sysctl -w vm.max_map_count=262144
   
   # To make this persistent across reboots:
   echo "vm.max_map_count=262144" | sudo tee -a /etc/sysctl.conf
   ```

3. **Load the Docker images:**
   ```bash
   docker load -i al4-images.tar
   ```

4. **Bring the core components online (detached):**
   ```bash
   cd al4-local
   docker compose up -d --wait
   ```

5. **Bring up the bootstrap instance that seeds Kibana and Elasticsearch (this only needs to run once):**
   ```bash
   docker compose -f bootstrap-compose.yaml up
   ```

## Final Access
Access the UI using default credentials at `https://localhost` (or the IP of your offline machine). 
Make sure your proxy/downstream configurations (such as `.env` files routing to AL4) define the correct endpoint:
`ASSEMBLYLINE_URL=https://localhost`
