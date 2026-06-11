#!/bin/bash

# Script para generar certificados SSL auto-firmados para desarrollo
# Certificados válidos por 5 años

CERT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CERT_FILE="$CERT_DIR/server.crt"
KEY_FILE="$CERT_DIR/server.key"

echo "🔐 Generando certificados SSL auto-firmados..."

# Generar certificado auto-firmado válido por 5 años (1825 días)
openssl req -x509 -newkey rsa:2048 -keyout "$KEY_FILE" -out "$CERT_FILE" \
  -days 1825 -nodes \
  -subj "/C=CO/ST=Bogota/L=Bogota/O=ZENTRA/CN=localhost"

if [ $? -eq 0 ]; then
  echo "✅ Certificados creados exitosamente:"
  echo "   Certificado: $CERT_FILE"
  echo "   Clave privada: $KEY_FILE"
  echo ""
  echo "⚠️  NOTA: Estos certificados son auto-firmados para desarrollo."
  echo "   El navegador mostrará advertencia de seguridad (es normal)."
else
  echo "❌ Error al generar certificados"
  exit 1
fi