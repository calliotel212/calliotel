#!/bin/bash
echo "Setting up API keys for Drama Me..."
echo ""
# 1. ElevenLabs
read -p "Paste your ElevenLabs API key (sk_...): " EL_KEY
if [ -z "$EL_KEY" ]; then
  echo "No key entered. Exiting."
  exit 1
fi
printf "$EL_KEY" | vercel env add ELEVENLABS_API_KEY production
echo "ElevenLabs key added."
echo ""
# 2. fal.ai
read -p "Paste your fal.ai API key: " FAL_KEY
if [ -z "$FAL_KEY" ]; then
  echo "No key entered. Exiting."
  exit 1
fi
printf "$FAL_KEY" | vercel env add FAL_API_KEY production
echo "fal.ai key added."
echo ""
# 3. Deploy
echo "Deploying to Vercel..."
vercel --prod
echo "Done."
