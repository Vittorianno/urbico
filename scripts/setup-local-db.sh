#!/usr/bin/env bash
# Configura o MariaDB local (Termux) para o Urbico, atualiza o .env e aplica as
# migrações. Pode ser rodado de novo sem problema: reaproveita o banco e a senha
# que já funcionam e só cria o que falta.
#
# Uso (na pasta do projeto):   bash scripts/setup-local-db.sh
#
# Nunca imprime senhas nem segredos.
set -euo pipefail
cd "$(dirname "$0")/.."

DB_NAME="urbico"
DB_USER="urbico"
say() { printf '\n== %s ==\n' "$*"; }
die() { printf '\nERRO: %s\n' "$*" >&2; exit 1; }

command -v mysql >/dev/null 2>&1 || die "MariaDB não instalado. Rode: pkg install mariadb"
command -v pnpm >/dev/null 2>&1 || die "pnpm não encontrado. Instale o pnpm antes."

# ---------------------------------------------------------------- 1. servidor
say "1/6 Servidor MariaDB"
DATADIR="${PREFIX:-/data/data/com.termux/files/usr}/var/lib/mysql"
if ! mysqladmin -u root ping --silent 2>/dev/null; then
  if [ ! -d "$DATADIR/mysql" ]; then
    echo "Inicializando o diretório de dados..."
    mysql_install_db >/dev/null 2>&1 || die "Não consegui inicializar o MariaDB (mysql_install_db)."
  fi
  echo "Iniciando o MariaDB em segundo plano..."
  nohup mysqld_safe >/dev/null 2>&1 &
  for _ in $(seq 1 40); do
    mysqladmin -u root ping --silent 2>/dev/null && break
    sleep 1
  done
fi
mysqladmin -u root ping --silent 2>/dev/null || die "O MariaDB não respondeu em 40 s. Tente: mysqld_safe &"
echo "MariaDB respondendo."

# ---------------------------------------------------------------- 2. .env base
say "2/6 Arquivo .env"
touch .env
chmod 600 .env
BACKUP=".env.backup.$(date +%Y%m%d_%H%M%S)"
cp .env "$BACKUP"
chmod 600 "$BACKUP"
echo "Backup protegido: $BACKUP"
grep -qxE '\.env(\.\*)?' .gitignore 2>/dev/null || printf '\n.env\n.env.*\n!.env.example\n' >> .gitignore
# garante quebra de linha no fim antes de acrescentar chaves
if [ -s .env ] && [ -n "$(tail -c1 .env)" ]; then echo >> .env; fi

has_env() { grep -Eq "^${1}=.+" .env; }
set_env() {
  local key="$1" value="$2"
  if grep -q "^${key}=" .env; then
    sed -i "s|^${key}=.*|${key}=${value}|" .env
  else
    printf '%s=%s\n' "$key" "$value" >> .env
  fi
}
random_string() { LC_ALL=C tr -dc 'A-Za-z0-9' </dev/urandom | head -c "$1" || true; }

# ------------------------------------------------- 3. banco e usuário do Urbico
say "3/6 Banco e usuário"
REUSE=0
CURRENT_URL="$(grep -E '^DATABASE_URL=' .env | tail -n1 | cut -d= -f2- | tr -d "'\"" || true)"
if [[ "$CURRENT_URL" =~ ^mysql://([^:]+):([^@]+)@([^:/]+):([0-9]+)/(.+)$ ]]; then
  C_USER="${BASH_REMATCH[1]}"; C_PASS="${BASH_REMATCH[2]}"; C_HOST="${BASH_REMATCH[3]}"; C_PORT="${BASH_REMATCH[4]}"; C_DB="${BASH_REMATCH[5]}"
  # A senha de exemplo do passo-a-passo anterior NÃO deve ser mantida.
  if [ "$C_PASS" != "TROQUE_ESTA_SENHA" ] && MYSQL_PWD="$C_PASS" mysql -h "$C_HOST" -P "$C_PORT" -u "$C_USER" "$C_DB" -e "SELECT 1" >/dev/null 2>&1; then
    REUSE=1
    DB_URL="$CURRENT_URL"
    echo "A DATABASE_URL atual já funciona; mantida."
  fi
fi

if [ "$REUSE" -eq 0 ]; then
  PASS="$(random_string 28)"
  [ "${#PASS}" -ge 20 ] || die "Falha ao gerar a senha do banco."
  mysql -u root <<SQL
CREATE DATABASE IF NOT EXISTS \`$DB_NAME\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '$DB_USER'@'localhost' IDENTIFIED BY '$PASS';
CREATE USER IF NOT EXISTS '$DB_USER'@'127.0.0.1' IDENTIFIED BY '$PASS';
ALTER USER '$DB_USER'@'localhost' IDENTIFIED BY '$PASS';
ALTER USER '$DB_USER'@'127.0.0.1' IDENTIFIED BY '$PASS';
GRANT ALL PRIVILEGES ON \`$DB_NAME\`.* TO '$DB_USER'@'localhost';
GRANT ALL PRIVILEGES ON \`$DB_NAME\`.* TO '$DB_USER'@'127.0.0.1';
FLUSH PRIVILEGES;
SQL
  DB_URL="mysql://$DB_USER:$PASS@127.0.0.1:3306/$DB_NAME"
  set_env DATABASE_URL "$DB_URL"
  echo "Banco '$DB_NAME' e usuário '$DB_USER' prontos; DATABASE_URL gravada no .env (senha aleatória)."
fi

# ----------------------------------------------------------- 4. demais variáveis
say "4/6 Variáveis do servidor"
if ! has_env JWT_SECRET; then
  set_env JWT_SECRET "$(random_string 64)"
  echo "JWT_SECRET gerado."
else
  echo "JWT_SECRET já existe; mantido (trocar deslogaria todo mundo)."
fi
if ! has_env GOOGLE_AUTH_REDIRECT_URI; then
  set_env GOOGLE_AUTH_REDIRECT_URI "http://localhost:3000/api/auth/google/callback"
  echo "GOOGLE_AUTH_REDIRECT_URI definida para o ambiente local."
fi

valid_value() { [[ "$1" =~ ^[A-Za-z0-9._~:/+=@-]+$ ]]; }
if [ -r /dev/tty ]; then
  if ! has_env GOOGLE_CLIENT_ID; then
    read -r -p "GOOGLE_CLIENT_ID (Enter para pular): " GID </dev/tty || GID=""
    if [ -n "$GID" ]; then
      if valid_value "$GID"; then set_env GOOGLE_CLIENT_ID "$GID"; else echo "Valor ignorado: caracteres inesperados."; fi
    fi
  fi
  if ! has_env GOOGLE_CLIENT_SECRET; then
    read -r -s -p "GOOGLE_CLIENT_SECRET (oculto; Enter para pular): " GSEC </dev/tty || GSEC=""
    echo
    if [ -n "$GSEC" ]; then
      if valid_value "$GSEC"; then set_env GOOGLE_CLIENT_SECRET "$GSEC"; else echo "Valor ignorado: caracteres inesperados."; fi
    fi
  fi
fi
for name in GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET; do
  has_env "$name" || echo "AVISO: $name ainda não definido — o login com Google não vai funcionar até preencher."
done

# ----------------------------------------------------------- 5. dependências e migrações
say "5/6 Dependências e migrações (pnpm install + db:push)"
pnpm install
DATABASE_URL="$DB_URL" pnpm db:push || die "db:push falhou. Se o drizzle-kit fez alguma pergunta, responda e rode o script de novo."

# ----------------------------------------------------------- 6. verificação
say "6/6 Verificação"
if [[ "$DB_URL" =~ ^mysql://([^:]+):([^@]+)@([^:/]+):([0-9]+)/(.+)$ ]]; then
  V_USER="${BASH_REMATCH[1]}"; V_PASS="${BASH_REMATCH[2]}"; V_HOST="${BASH_REMATCH[3]}"; V_PORT="${BASH_REMATCH[4]}"; V_DB="${BASH_REMATCH[5]}"
  TABLES="$(MYSQL_PWD="$V_PASS" mysql -h "$V_HOST" -P "$V_PORT" -u "$V_USER" "$V_DB" -N -e "SHOW TABLES" 2>/dev/null | wc -l | tr -d ' ')"
  AVATAR="$(MYSQL_PWD="$V_PASS" mysql -h "$V_HOST" -P "$V_PORT" -u "$V_USER" "$V_DB" -N -e "SHOW COLUMNS FROM users LIKE 'avatarUrl'" 2>/dev/null | wc -l | tr -d ' ')"
  echo "Tabelas no banco: $TABLES"
  [ "$AVATAR" -ge 1 ] && echo "Coluna users.avatarUrl: OK" || echo "AVISO: coluna users.avatarUrl não encontrada."
fi

echo
echo "Pronto. Lembretes:"
echo " - Em toda nova sessão do Termux, inicie o banco antes:  mysqld_safe &   (ou rode este script de novo)"
echo " - No Google Cloud, cadastre o redirecionamento:  http://localhost:3000/api/auth/google/callback"
echo " - O db:push pode ter criado arquivos novos em drizzle/ — eles devem ir para o Git (git add drizzle)."
echo

if [ -r /dev/tty ]; then
  read -r -p "Iniciar o app agora (pnpm dev)? [S/n] " ANSWER </dev/tty || ANSWER="n"
  case "${ANSWER:-S}" in
    [nN]*) echo "Para iniciar depois:  pnpm dev" ;;
    *) exec pnpm dev ;;
  esac
fi
