#!/bin/bash
# pack-online.sh
# Script to prepare Assemblyline 4 offline bundle from an internet-connected machine.

set -e

echo "[+] Cloning official CCCS docker-compose repository..."
git clone https://github.com/CybercentreCanada/assemblyline-docker-compose.git al4-local
cd al4-local

echo "[+] Generating self-signed certificate..."
mkdir -p config
openssl req -nodes -x509 -newkey rsa:4096 -keyout config/nginx.key -out config/nginx.crt -days 365 -subj "/C=CA/ST=Ontario/L=Ottawa/O=CCCS/CN=assemblyline.local"

echo "[+] Pulling images from Docker Hub..."
docker compose pull --ignore-buildable
docker compose -f bootstrap-compose.yaml pull

echo "[+] Building necessary dependent containers..."
env COMPOSE_BAKE=true docker compose build

echo "[+] Saving all local Docker images to al4-images.tar..."
docker save $(docker images -q) -o ../al4-images.tar

echo "[+] Archiving the bundle to al4-offline-bundle.tar.gz..."
cd ..
tar -czvf al4-offline-bundle.tar.gz al4-local/ al4-images.tar

echo "[+] Done! You can now transfer al4-offline-bundle.tar.gz to your offline machine."
