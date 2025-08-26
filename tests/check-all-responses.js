const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const allResponses = await prisma.questionnaireResponse.findMany({
    orderBy: { id: 'desc' },
    include: { result: true }
  });
  
  console.log(`\n=== ALL ${allResponses.length} QUESTIONNAIRE RESPONSES ===`);
  
  const groupedBySport = allResponses.reduce((acc, response) => {
    if (!acc[response.sport]) {
      acc[response.sport] = [];
    }
    acc[response.sport].push(response);
    return acc;
  }, {});

  for (const [sport, responses] of Object.entries(groupedBySport)) {
    console.log(`\n🎾 ${sport.toUpperCase()} (${responses.length} responses):`);
    
    responses.forEach((r, i) => {
      console.log(`\n  ${i+1}. Response ID: ${r.id} (${r.completedAt})`);
      console.log(`     User ID: ${r.userId}`);
      console.log(`     Questions answered:`);
      
      const answers = r.answersJson;
      Object.keys(answers).forEach(key => {
        const value = answers[key];
        if (typeof value === 'object' && value !== null) {
          console.log(`       ✅ ${key}: ${Object.keys(value).length} sub-answers`);
          Object.keys(value).forEach(subKey => {
            console.log(`         - ${subKey}: "${value[subKey]}"`);
          });
        } else {
          console.log(`       ✅ ${key}: "${value}"`);
        }
      });
      
      if (r.result) {
        console.log(`     Rating: ${r.result.singles} (±${r.result.rd}) - ${r.result.confidence}`);
      }
    });
  }

  // Summary of question coverage
  console.log(`\n📊 QUESTION COVERAGE SUMMARY:`);
  for (const [sport, responses] of Object.entries(groupedBySport)) {
    if (responses.length > 0) {
      const latestResponse = responses[0];
      const questions = Object.keys(latestResponse.answersJson);
      console.log(`\n${sport.toUpperCase()}:`);
      console.log(`  Questions covered: ${questions.join(', ')}`);
      
      if (latestResponse.answersJson.skills) {
        const skills = Object.keys(latestResponse.answersJson.skills);
        console.log(`  Skills covered: ${skills.join(', ')}`);
      }
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
