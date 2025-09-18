#!/bin/bash

set -e

echo "🧪 Testing Admin Notes AI POC API"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

BASE_URL="http://localhost:3000"
STUDENT_ID="123e4567-e89b-12d3-a456-426614174000"
AUTHOR_ID="456e7890-e89b-12d3-a456-426614174001"

# Check if server is running
echo -e "${BLUE}Checking if server is running...${NC}"
if ! curl -f $BASE_URL/health > /dev/null 2>&1; then
    echo -e "${RED}❌ Server is not running on $BASE_URL${NC}"
    echo "   Start it with: bun run dev"
    exit 1
fi

echo -e "${GREEN}✅ Server is running${NC}"

# Test 1: Health check
echo -e "\n${BLUE}📊 Testing health check...${NC}"
curl -s $BASE_URL/health | jq '.'

# Test 2: Detailed health check
echo -e "\n${BLUE}🔍 Testing detailed health check...${NC}"
curl -s $BASE_URL/health/detailed | jq '.'

# Test 3: Create admin note
echo -e "\n${BLUE}📝 Creating admin note...${NC}"
CREATE_RESPONSE=$(curl -s -X POST $BASE_URL/api/admin-notes \
  -H "Content-Type: application/json" \
  -d "{
    \"studentId\": \"$STUDENT_ID\",
    \"content\": \"Student demonstrated exceptional problem-solving skills during today's mathematics lesson. Completed complex word problems independently and offered to help struggling classmates. Shows strong leadership potential.\",
    \"authorId\": \"$AUTHOR_ID\"
  }")

echo $CREATE_RESPONSE | jq '.'

# Extract note ID for follow-up tests
NOTE_ID=$(echo $CREATE_RESPONSE | jq -r '.note.id')
echo -e "${GREEN}✅ Created note with ID: $NOTE_ID${NC}"

# Test 4: Wait a moment for AI processing
echo -e "\n${BLUE}⏳ Waiting 3 seconds for AI processing...${NC}"
sleep 3

# Test 5: Get student notes
echo -e "\n${BLUE}📚 Fetching student notes...${NC}"
curl -s $BASE_URL/api/students/$STUDENT_ID/notes | jq '.'

# Test 6: Get student summaries
echo -e "\n${BLUE}🤖 Fetching AI summaries...${NC}"
curl -s $BASE_URL/api/students/$STUDENT_ID/summaries | jq '.'

# Test 7: Get latest summary
echo -e "\n${BLUE}🎯 Fetching latest AI summary...${NC}"
curl -s $BASE_URL/api/students/$STUDENT_ID/summary/latest | jq '.'

# Test 8: Test validation error
echo -e "\n${BLUE}⚠️  Testing validation error...${NC}"
curl -s -X POST $BASE_URL/api/admin-notes \
  -H "Content-Type: application/json" \
  -d '{
    "studentId": "invalid-uuid",
    "content": "",
    "authorId": "also-invalid"
  }' | jq '.'

# Test 9: Test 404 for non-existent student
echo -e "\n${BLUE}🔍 Testing 404 for non-existent student...${NC}"
curl -s $BASE_URL/api/students/00000000-0000-0000-0000-000000000000/summary/latest | jq '.'

echo -e "\n${GREEN}🎉 All API tests completed!${NC}"

# Additional test suggestions
echo -e "\n${BLUE}💡 Additional manual tests:${NC}"
echo "   - Create multiple notes and watch AI processing in logs"
echo "   - Test with rich text content (HTML/Markdown)"
echo "   - Monitor PostgreSQL notifications: SELECT pg_notify('test', 'hello');"
echo "   - Check database directly with: bun run db:studio"