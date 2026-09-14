#!/bin/bash

# Установка Telegram webhook для school-bot на Vercel

curl -X POST "https://api.telegram.org/bot8638106001:AAGNYZGb94SI5ehrCwz4ikz7OGM-0sno_hA/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://school-bot-omega.vercel.app/api/telegram/webhook",
    "secret_token": "5GJv0wvNP2ySght2hxFQfcLbOOTZcKFTEZqlaA21SuSUtAU7TOxDuqEaLKlFKiKzc5OMdpfVkrGojlyfCyrI3JnsHq2ll6mEAdM85PuaR75rQz9dTM4UdE07Qavh6RMu6iCQbPfr4v4UVqrxxPxAHAmB7gOcwJZSsTQJuxrFUNnjifoZJzkLO2jl8GVAWK3qLg1PBV12",
    "allowed_updates": ["message", "callback_query"]
  }'

echo ""
echo "Webhook установлен!"
