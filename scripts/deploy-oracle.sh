#!/usr/bin/env bash
# Urbico — provisionamento do backend na Oracle Linux 9 (idempotente).
#
# Uso (na instância, como usuário comum com sudo, ex.: opc):
#   bash scripts/deploy-oracle.sh check   # somente leitura (padrão): diagnostica
#   LE_EMAIL=voce@exemplo.com bash scripts/deploy-oracle.sh apply
#
# O que faz no modo apply: instala Node 20, nginx e certbot; abre 80/443 no
# firewalld; compila o backend; cria o serviço systemd `urbico`; configura o
# proxy reverso e o certificado Let's Encrypt (renovação automática).
#
# O que NÃO faz: não lê nem imprime valores do .env; não roda migrações do
# banco (pnpm db:push é manual, depois de backup); não altera VCN/Security
# List da OCI (portas 80/443 precisam estar liberadas lá também); não expõe
# a porta do backend nem o MySQL.
set -euo pipefail

MODE="${1:-check}"
DOMAIN="${URBICO_DOMAIN:-urbico.duckdns.org}"
APP_DIR="${URBICO_DIR:-$HOME/urbico}"
APP_PORT="${URBICO_PORT:-3000}"
LE_EMAIL="${LE_EMAIL:-}"
SERVICE="urbico"

say()  { printf '\n== %s\n' "$*"; }
ok()   { printf '  [ok]   %s\n' "$*"; }
warn() { printf '  [warn] %s\n' "$*"; }
bad()  { printf '  [FALHA] %s\n' "$*"; }
have() { command -v "$1" >/dev/null 2>&1; }
env_has() { [ -f "$APP_DIR/.env" ] && grep -qE "^$1=.+" "$APP_DIR/.env"; }

check() {
  say "Sistema"
  grep -E '^PRETTY_NAME=' /etc/os-release || true
  uptime; free -m | sed -n '1,2p'
  if swapon --show | grep -q .; then ok "swap ativo"; else warn "sem swap (VM pequena pode falhar no build; veja ADD_SWAP=1)"; fi

  say "Ferramentas"
  for t in node pnpm git nginx certbot; do
    if have "$t"; then ok "$t: $("$t" --version 2>&1 | head -1)"; else warn "$t ausente"; fi
  done
  have mysql || have mariadb && ok "cliente mysql/mariadb presente" || warn "cliente mysql ausente"

  say "Repositório e .env (somente nomes, nunca valores)"
  if [ -d "$APP_DIR/.git" ]; then ok "$(git -C "$APP_DIR" log -1 --oneline)"; else bad "repositório não encontrado em $APP_DIR"; fi
  for v in DATABASE_URL JWT_SECRET SUPABASE_URL SUPABASE_ANON_KEY CORS_ALLOWED_ORIGINS; do
    if env_has "$v"; then ok "$v definido"; else bad "$v ausente/vazio no .env"; fi
  done
  if [ -f "$APP_DIR/.env" ]; then
    dups=$(grep -oE '^[A-Z_]+=' "$APP_DIR/.env" | sort | uniq -d | tr -d '=' | tr '\n' ' ')
    [ -z "$dups" ] && ok "sem chaves duplicadas" || warn "chaves duplicadas no .env: $dups"
    grep -qE "^CORS_ALLOWED_ORIGINS=.*$DOMAIN" "$APP_DIR/.env" && ok "CORS inclui $DOMAIN" || warn "CORS_ALLOWED_ORIGINS não menciona $DOMAIN"
  fi

  say "Portas locais"
  sudo -n ss -tlnp 2>/dev/null | grep -E ":(22|80|443|$APP_PORT)\b" || ss -tln | grep -E ":(22|80|443|$APP_PORT)\b" || warn "nada escutando em 80/443/$APP_PORT"

  say "Firewall do SO"
  if have firewall-cmd; then sudo -n firewall-cmd --state 2>&1 || true; sudo -n firewall-cmd --list-all 2>&1 | grep -E 'services|ports' || true; else warn "firewall-cmd ausente"; fi

  say "Serviços"
  for s in "$SERVICE" nginx; do printf '  %s: %s\n' "$s" "$(systemctl is-active "$s" 2>&1 || true)"; done

  say "Backend local"
  curl -sS -m 5 "http://127.0.0.1:$APP_PORT/api/health" || warn "/api/health não respondeu"; echo
  curl -sS -m 8 -w ' (HTTP %{http_code})' "http://127.0.0.1:$APP_PORT/api/ready" || warn "/api/ready não respondeu"; echo

  say "MySQL (host/porta extraídos do DATABASE_URL, sem credenciais)"
  if env_has DATABASE_URL; then
    hp=$(grep -E '^DATABASE_URL=' "$APP_DIR/.env" | head -1 | sed -E 's|^[^=]+=||; s|^["'\'']||; s|["'\'']$||; s|^[a-z]+://[^@]*@||; s|/.*$||')
    host="${hp%%:*}"; port="${hp##*:}"; [ "$port" = "$hp" ] && port=3306
    printf '  destino: %s:%s\n' "$host" "$port"
    timeout 6 bash -c "</dev/tcp/$host/$port" 2>/dev/null && ok "TCP até o MySQL ok" || bad "sem TCP até o MySQL"
  fi

  say "HTTPS a partir da própria instância"
  curl -sS -m 8 -I "https://$DOMAIN/api/health" 2>&1 | head -3 || true
}

apply() {
  [ -d "$APP_DIR/.git" ] || { bad "clone o repositório em $APP_DIR primeiro"; exit 1; }
  env_has DATABASE_URL && env_has JWT_SECRET || { bad "complete DATABASE_URL e JWT_SECRET no .env"; exit 1; }

  if [ "${ADD_SWAP:-0}" = "1" ] && ! swapon --show | grep -q .; then
    say "Criando swap de 2G"
    sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
    grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
  fi

  say "Pacotes"
  sudo dnf install -y git curl nginx oracle-epel-release-el9 >/dev/null
  if ! have node || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 20 ]; then
    sudo dnf module -y enable nodejs:20 >/dev/null
    sudo dnf install -y nodejs >/dev/null
  fi
  sudo dnf install -y certbot python3-certbot-nginx >/dev/null
  sudo corepack enable
  corepack prepare pnpm@9.12.0 --activate

  say "Firewall do SO (somente 80/443; a porta $APP_PORT NÃO é aberta)"
  sudo firewall-cmd --permanent --add-service=http --add-service=https >/dev/null
  sudo firewall-cmd --reload >/dev/null
  sudo setsebool -P httpd_can_network_connect 1

  say "Build"
  cd "$APP_DIR"
  pnpm install --frozen-lockfile
  pnpm build

  say "Serviço systemd"
  sudo tee "/etc/systemd/system/$SERVICE.service" >/dev/null <<EOF
[Unit]
Description=Urbico backend
After=network-online.target
Wants=network-online.target

[Service]
User=$USER
WorkingDirectory=$APP_DIR
Environment=NODE_ENV=production
Environment=PORT=$APP_PORT
ExecStart=$(command -v node) dist/index.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
  sudo systemctl daemon-reload
  sudo systemctl enable --now "$SERVICE"
  sudo systemctl restart "$SERVICE"

  say "nginx (proxy reverso)"
  sudo tee /etc/nginx/conf.d/urbico.conf >/dev/null <<EOF
server {
    listen 80;
    server_name $DOMAIN;
    client_max_body_size 2m;
    location / {
        proxy_pass http://127.0.0.1:$APP_PORT;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 60s;
    }
}
EOF
  sudo nginx -t
  sudo systemctl enable --now nginx
  sudo systemctl reload nginx

  say "Certificado TLS"
  if [ -z "$LE_EMAIL" ]; then
    warn "defina LE_EMAIL para emitir o certificado; rode de novo: LE_EMAIL=... bash scripts/deploy-oracle.sh apply"
  else
    sudo certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "$LE_EMAIL" --redirect
    sudo systemctl enable --now certbot-renew.timer 2>/dev/null || warn "timer de renovação não encontrado; verifique 'systemctl list-timers | grep certbot'"
  fi

  say "Verificação"
  sleep 3
  check
}

case "$MODE" in
  check) check ;;
  apply) apply ;;
  *) echo "uso: $0 [check|apply]"; exit 2 ;;
esac
