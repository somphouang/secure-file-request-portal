#!/bin/bash
# deploy-offline.sh
# Wrapper script to execute the deploy-offline.yml playbook
# Supports Ubuntu 24.04 LTS and RHEL 9.x

set -e

echo "[+] Assuring Ansible is available..."

if ! command -v ansible-playbook &> /dev/null; then
    echo "[!] Ansible is not installed. Attempting to install via package manager..."
    
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        case $ID in
            ubuntu|debian)
                echo "[+] Detected $NAME, using apt..."
                sudo apt-get update
                sudo DEBIAN_FRONTEND=noninteractive apt-get install -y ansible
                ;;
            rhel|centos|almalinux|rocky)
                echo "[+] Detected $NAME ($VERSION_ID), using dnf..."
                # EPEL could be required for Ansible depending on the RHEL 9 subscription
                sudo dnf install -y epel-release || true
                sudo dnf install -y ansible-core
                ;;
            *)
                echo "[-] Unsupported OS for automatic Ansible installation: $NAME"
                echo "Please install ansible manually and re-run, or perform the deployment manually."
                exit 1
                ;;
        esac
    else
        echo "[-] Cannot detect OS from /etc/os-release. Please install Ansible manually."
        exit 1
    fi
else
    echo "[+] Ansible is already installed."
fi

echo "======================================================"
echo "[+] Starting Assemblyline 4 Deployment via Ansible..."
echo "======================================================"

# Run the playbook locally
ansible-playbook deploy-offline.yml

echo "[+] Deployment playbook finished."
