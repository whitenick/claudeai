#!/bin/bash

set -e

echo "🧪 Testing AI Provider Switching in Admin Notes POC"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

BASE_URL="http://localhost:3000"

# Check if server is running
echo -e "${BLUE}Checking if server is running...${NC}"
if ! curl -f $BASE_URL/health > /dev/null 2>&1; then
    echo -e "${RED}❌ Server is not running on $BASE_URL${NC}"
    echo "   Start it with: bun run dev"
    exit 1
fi

echo -e "${GREEN}✅ Server is running${NC}"

# Test 1: Get current AI provider status
echo -e "\n${BLUE}📊 Getting current AI provider status...${NC}"
curl -s $BASE_URL/api/ai/provider/status | jq '.'

# Test 2: Get available providers
echo -e "\n${BLUE}🔍 Getting available AI providers...${NC}"
curl -s $BASE_URL/api/ai/providers | jq '.'

# Test 3: Get recommended settings for summarization
echo -e "\n${BLUE}⚙️  Getting recommended settings for summarization...${NC}"
curl -s $BASE_URL/api/ai/settings/summarization | jq '.'

# Test 4: Test with current provider (create a note to trigger AI)
echo -e "\n${BLUE}📝 Creating admin note to test current AI provider...${NC}"
STUDENT_ID="123e4567-e89b-12d3-a456-426614174000"
AUTHOR_ID="456e7890-e89b-12d3-a456-426614174001"

CREATE_RESPONSE=$(curl -s -X POST $BASE_URL/api/admin-notes \
  -H "Content-Type: application/json" \
  -d "{
    \"studentId\": \"$STUDENT_ID\",
    \"content\": \"[AI Provider Test] Student demonstrated excellent collaborative skills during group project. Took initiative in organizing team tasks and helped struggling teammates understand complex concepts. Shows strong leadership potential and empathy.\",
    \"authorId\": \"$AUTHOR_ID\"
  }")

echo $CREATE_RESPONSE | jq '.'

# Wait for AI processing
echo -e "\n${BLUE}⏳ Waiting 5 seconds for AI processing...${NC}"
sleep 5

# Check if summary was generated
echo -e "\n${BLUE}📊 Checking for generated AI summary...${NC}"
curl -s $BASE_URL/api/students/$STUDENT_ID/summary/latest | jq '.'

# Test 5: Switch provider (if OpenAI key is available)
echo -e "\n${YELLOW}⚠️  Provider switching test${NC}"
echo "To test provider switching, you need to:"
echo "1. Set OPENAI_API_KEY in your environment"
echo "2. Run the following command:"
echo ""
echo -e "${BLUE}curl -X POST $BASE_URL/api/ai/provider/switch \\${NC}"
echo -e "${BLUE}  -H \"Content-Type: application/json\" \\${NC}"
echo -e "${BLUE}  -d '{${NC}"
echo -e "${BLUE}    \"provider\": \"openai\",${NC}"
echo -e "${BLUE}    \"apiKey\": \"your_openai_api_key\",${NC}"
echo -e "${BLUE}    \"model\": \"gpt-4-turbo\"${NC}"
echo -e "${BLUE}  }'${NC}"
echo ""

# Test 6: Test health check with AI provider info
echo -e "\n${BLUE}🏥 Testing detailed health check (includes AI status)...${NC}"
curl -s $BASE_URL/health/detailed | jq '.'

echo -e "\n${GREEN}🎉 AI provider tests completed!${NC}"

echo -e "\n${BLUE}💡 Additional tests you can try:${NC}"
echo "   - Switch between Claude and OpenAI providers"
echo "   - Test with different models (gpt-4, gpt-3.5-turbo, claude-3-opus, etc.)"
echo "   - Compare summary quality between providers"
echo "   - Test error handling with invalid API keys"
echo "   - Monitor logs to see provider-specific behavior"