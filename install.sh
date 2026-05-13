#!/usr/bin/env bash
# install.sh — One-command installer for android-llm-cli on Termux
# Usage: bash <(curl -fsSL https://raw.githubusercontent.com/kamaero/android-llm-cli/main/install.sh)

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

REPO_URL="https://github.com/kamaero/android-llm-cli.git"
INSTALL_DIR="${HOME}/android-llm-cli"
CONFIG_DIR="${HOME}/.config/a-llmcli"

echo -e "${BLUE}╔══════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║       android-llm-cli Installer              ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════╝${NC}"
echo ""

# ── 1. Check prerequisites ──
echo -e "${YELLOW}[1/5] Проверка зависимостей...${NC}"

if ! command -v node &>/dev/null; then
  echo "  → Устанавливаю Node.js..."
  pkg install -y nodejs
fi

if ! command -v git &>/dev/null; then
  echo "  → Устанавливаю git..."
  pkg install -y git
fi

NODE_VER=$(node --version | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VER" -lt 20 ]; then
  echo -e "${RED}  ✗ Нужен Node.js >= 20, у вас v${NODE_VER}${NC}"
  echo "  → Обновите: pkg upgrade nodejs"
  exit 1
fi
echo -e "${GREEN}  ✓ Node.js $(node --version)${NC}"
echo -e "${GREEN}  ✓ git $(git --version | awk '{print $3}')${NC}"

# ── 2. Clone / update repo ──
echo -e "${YELLOW}[2/5] Клонирование репозитория...${NC}"

if [ -d "$INSTALL_DIR" ]; then
  echo "  → Репо уже есть, обновляю..."
  cd "$INSTALL_DIR"
  git pull --ff-only
else
  git clone "$REPO_URL" "$INSTALL_DIR"
  cd "$INSTALL_DIR"
fi
echo -e "${GREEN}  ✓ Репозиторий готов${NC}"

# ── 3. Install dependencies + build ──
echo -e "${YELLOW}[3/5] Установка зависимостей и сборка...${NC}"

npm install
npm run build
echo -e "${GREEN}  ✓ Сборка завершена${NC}"

# ── 4. Install globally ──
echo -e "${YELLOW}[4/5] Регистрация команды...${NC}"

npm install -g .

# Проверка
if command -v a-llmcli &>/dev/null; then
  echo -e "${GREEN}  ✓ a-llmcli зарегистрирован: $(which a-llmcli)${NC}"
else
  echo -e "${RED}  ✗ a-llmcli не найден в PATH${NC}"
  echo "  → Добавьте в ~/.bashrc:"
  echo "    export PATH=\"\$(npm bin -g):\$PATH\""
fi

# ── 5. Config ──
echo -e "${YELLOW}[5/5] Настройка...${NC}"

if [ ! -f "${CONFIG_DIR}/config.yaml" ]; then
  mkdir -p "$CONFIG_DIR"
  cp config.example.yaml "${CONFIG_DIR}/config.yaml"
  chmod 600 "${CONFIG_DIR}/config.yaml"
  echo -e "${GREEN}  ✓ config.yaml создан: ${CONFIG_DIR}/config.yaml${NC}"
  echo ""
  echo -e "${YELLOW}  ⚠ Не забудьте добавить API-ключ!${NC}"
  echo "    export ANTHROPIC_API_KEY=\"sk-ant-...\" >> ~/.bashrc"
  echo "    source ~/.bashrc"
  echo "    a-llmcli setup    # интерактивный мастер"
else
  echo -e "${GREEN}  ✓ config.yaml уже существует${NC}"
fi

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  Установка завершена!                         ║${NC}"
echo -e "${GREEN}║                                              ║${NC}"
echo -e "${GREEN}║  Запуск:  a-llmcli --help                     ║${NC}"
echo -e "${GREEN}║  Тест:    a-llmcli --mock                      ║${NC}"
echo -e "${GREEN}║  Чат:     a-llmcli                             ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════╝${NC}"
