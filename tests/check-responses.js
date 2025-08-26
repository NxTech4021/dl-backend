const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const responses = await prisma.questionnaireResponse.findMany({
    orderBy: { id: 'desc' },
    take: 3,
    include: { result: true }
  });
  
  console.log('=== LATEST QUESTIONNAIRE RESPONSES ===');
  responses.forEach((r, i) => {
    console.log(`\n${i+1}. Response ID: ${r.id}, Sport: ${r.sport}`);
    console.log('Answers JSON:', JSON.stringify(r.answersJson, null, 2));
    if (r.result) {
      console.log('Rating Result:', JSON.stringify(r.result, null, 2));
    }
    console.log('---');
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
