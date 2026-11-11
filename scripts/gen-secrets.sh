#!/bin/sh
# Erzeugt eine .env mit zufälligen Geheimnissen (bricht ab, wenn schon eine existiert)
set -e
cd "$(dirname "$0")/.."
if [ -f .env ]; then echo ".env existiert schon – nichts geändert."; exit 1; fi
rand() { head -c 48 /dev/urandom | base64 | tr -d '=+/\n' | cut -c1-40; }
sed -e "s/^DB_PASSWORD=.*/DB_PASSWORD=$(rand)/" -e "s/^ENCRYPTION_KEY=.*/ENCRYPTION_KEY=$(rand)/" .env.example > .env
chmod 600 .env
echo ".env angelegt. Port bei Bedarf in APP_PORT anpassen."
if docker volume inspect boxenstopp_db_data >/dev/null 2>&1; then
  echo "WARNUNG: Volume boxenstopp_db_data existiert schon – das neue DB_PASSWORD passt dann nicht."
fi
