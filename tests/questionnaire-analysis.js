// Comprehensive questionnaire comparison and validation script
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
  console.log('=== QUESTIONNAIRE COVERAGE ANALYSIS ===\n');

  // Load JSON questionnaires
  const questionnairePath = './src/data/questionnaires';
  const tennisJson = JSON.parse(fs.readFileSync(path.join(questionnairePath, 'tennis-questionnaire.v1.json')));
  const pickleballJson = JSON.parse(fs.readFileSync(path.join(questionnairePath, 'pickleball-questionnaire.v1.json')));
  const padelJson = JSON.parse(fs.readFileSync(path.join(questionnairePath, 'padel-questionnaire.v1.json')));

  // Check each sport
  checkTennisCoverage(tennisJson);
  checkPickleballCoverage(pickleballJson);
  checkPadelCoverage(padelJson);

  // Check database submissions
  await checkDatabaseSubmissions();
}

function checkTennisCoverage(json) {
  console.log('🎾 TENNIS QUESTIONNAIRE COVERAGE:');
  
  const pythonQuestions = [
    'experience', 'frequency', 'competitive_level', 'coaching_background', 
    'tournament', 'skills', 'self_rating'
  ];
  
  const pythonSkills = [
    'serving', 'forehand', 'backhand', 'net_play', 'movement', 'mental_game'
  ];

  const jsonQuestions = json.questions.map(q => q.key);
  const skillQuestion = json.questions.find(q => q.key === 'skills');
  const jsonSkills = skillQuestion ? skillQuestion.subQuestions.map(sq => sq.key) : [];

  console.log('✅ Main Questions Coverage:');
  pythonQuestions.forEach(q => {
    const covered = jsonQuestions.includes(q);
    console.log(`  ${covered ? '✅' : '❌'} ${q}: ${covered ? 'COVERED' : 'MISSING'}`);
  });

  console.log('✅ Skills Coverage:');
  pythonSkills.forEach(skill => {
    const covered = jsonSkills.includes(skill);
    console.log(`  ${covered ? '✅' : '❌'} ${skill}: ${covered ? 'COVERED' : 'MISSING'}`);
  });

  // Check Python answer options vs JSON
  console.log('✅ Answer Options Sample Check:');
  const expQuestion = json.questions.find(q => q.key === 'experience');
  if (expQuestion) {
    const labels = expQuestion.options.map(o => o.label);
    console.log('  Tennis Experience Options:', labels);
    
    // Check if Python options are covered
    const pythonOptions = [
      "Less than 6 months", "6 months - 1 year", "1-2 years", 
      "2-5 years", "More than 5 years"
    ];
    
    const jsonOptions = [
      "Less than 6 months", "6 months - 1 year", "1-2 years",
      "2-4 years", "More than 4 years"
    ];
    
    console.log('  ⚠️  NOTE: Python has "2-5 years" & "More than 5 years", JSON has "2-4 years" & "More than 4 years"');
  }
  console.log();
}

function checkPickleballCoverage(json) {
  console.log('🏓 PICKLEBALL QUESTIONNAIRE COVERAGE:');
  
  const pythonQuestions = [
    'has_dupr', 'dupr_singles', 'dupr_doubles', 'dupr_singles_reliability', 
    'dupr_doubles_reliability', 'experience', 'sports_background', 'frequency', 
    'competitive_level', 'skills', 'self_rating', 'tournament'
  ];
  
  const pythonSkills = [
    'serving', 'dinking', 'volleys', 'positioning'
  ];

  const jsonQuestions = json.questions.map(q => q.key);
  const skillQuestion = json.questions.find(q => q.key === 'skills');
  const jsonSkills = skillQuestion ? skillQuestion.subQuestions.map(sq => sq.key) : [];

  console.log('✅ Main Questions Coverage:');
  pythonQuestions.forEach(q => {
    const covered = jsonQuestions.includes(q);
    console.log(`  ${covered ? '✅' : '❌'} ${q}: ${covered ? 'COVERED' : 'MISSING'}`);
  });

  console.log('✅ Skills Coverage:');
  pythonSkills.forEach(skill => {
    const covered = jsonSkills.includes(skill);
    console.log(`  ${covered ? '✅' : '❌'} ${skill}: ${covered ? 'COVERED' : 'MISSING'}`);
  });

  console.log('✅ DUPR Integration:');
  const hasDupr = json.questions.find(q => q.key === 'has_dupr');
  console.log(`  ${hasDupr ? '✅' : '❌'} DUPR detection: ${hasDupr ? 'IMPLEMENTED' : 'MISSING'}`);
  
  const duprSingles = json.questions.find(q => q.key === 'dupr_singles');
  console.log(`  ${duprSingles ? '✅' : '❌'} DUPR Singles input: ${duprSingles ? 'IMPLEMENTED' : 'MISSING'}`);
  
  const duprDoubles = json.questions.find(q => q.key === 'dupr_doubles');
  console.log(`  ${duprDoubles ? '✅' : '❌'} DUPR Doubles input: ${duprDoubles ? 'IMPLEMENTED' : 'MISSING'}`);
  console.log();
}

function checkPadelCoverage(json) {
  console.log('🎾 PADEL QUESTIONNAIRE COVERAGE:');
  
  const pythonQuestions = [
    'experience', 'sports_background', 'frequency', 'competitive_level', 
    'coaching_background', 'tournament', 'skills', 'self_rating'
  ];
  
  const pythonSkills = [
    'serving', 'wall_play', 'net_play', 'lob_smash', 'glass_play', 'positioning'
  ];

  const jsonQuestions = json.questions.map(q => q.key);
  const skillQuestion = json.questions.find(q => q.key === 'skills');
  const jsonSkills = skillQuestion ? skillQuestion.subQuestions.map(sq => sq.key) : [];

  console.log('✅ Main Questions Coverage:');
  pythonQuestions.forEach(q => {
    const covered = jsonQuestions.includes(q);
    console.log(`  ${covered ? '✅' : '❌'} ${q}: ${covered ? 'COVERED' : 'MISSING'}`);
  });

  console.log('✅ Skills Coverage:');
  pythonSkills.forEach(skill => {
    const covered = jsonSkills.includes(skill);
    console.log(`  ${covered ? '✅' : '❌'} ${skill}: ${covered ? 'COVERED' : 'MISSING'}`);
  });

  console.log('✅ Padel-Specific Features:');
  const hasWallPlay = jsonSkills.includes('wall_play') || jsonSkills.some(s => s.includes('wall'));
  console.log(`  ${hasWallPlay ? '✅' : '❌'} Wall play skills: ${hasWallPlay ? 'COVERED' : 'MISSING'}`);
  
  const hasGlassPlay = jsonSkills.includes('glass_play') || jsonSkills.some(s => s.includes('glass'));
  console.log(`  ${hasGlassPlay ? '✅' : '❌'} Glass play skills: ${hasGlassPlay ? 'COVERED' : 'MISSING'}`);
  console.log();
}

async function checkDatabaseSubmissions() {
  console.log('🗄️  DATABASE SUBMISSION ANALYSIS:');
  
  try {
    const responses = await prisma.questionnaireResponse.findMany({
      orderBy: { id: 'desc' },
      take: 10,
      include: { result: true }
    });

    const sportsSubmitted = [...new Set(responses.map(r => r.sport))];
    console.log('✅ Sports with submissions:', sportsSubmitted);

    // Check data completeness for each sport
    for (const sport of sportsSubmitted) {
      const sportResponses = responses.filter(r => r.sport === sport);
      console.log(`\n📊 ${sport.toUpperCase()} Submissions (${sportResponses.length} total):`);
      
      if (sportResponses.length > 0) {
        const latestResponse = sportResponses[0];
        const answers = latestResponse.answersJson;
        
        console.log('  📝 Answer Categories Submitted:');
        Object.keys(answers).forEach(key => {
          const value = answers[key];
          if (typeof value === 'object' && value !== null) {
            console.log(`    ✅ ${key}: ${Object.keys(value).length} sub-answers`);
          } else {
            console.log(`    ✅ ${key}: "${value}"`);
          }
        });

        if (latestResponse.result) {
          console.log('  🎯 Rating Calculation:');
          console.log(`    Singles: ${latestResponse.result.singles}`);
          console.log(`    Doubles: ${latestResponse.result.doubles}`);
          console.log(`    Confidence: ${latestResponse.result.confidence}`);
          console.log(`    RD: ±${latestResponse.result.rd}`);
        }
      }
    }

    // Check for missing question coverage
    console.log('\n🔍 COVERAGE GAPS ANALYSIS:');
    
    const tennisResponse = responses.find(r => r.sport === 'tennis');
    if (tennisResponse) {
      const answers = tennisResponse.answersJson;
      const expectedTennisKeys = ['experience', 'frequency', 'competitive_level', 'coaching_background', 'tournament', 'skills', 'self_rating'];
      
      console.log('Tennis question coverage:');
      expectedTennisKeys.forEach(key => {
        const covered = answers.hasOwnProperty(key);
        console.log(`  ${covered ? '✅' : '❌'} ${key}: ${covered ? 'SUBMITTED' : 'MISSING'}`);
      });

      if (answers.skills) {
        const expectedSkills = ['serving', 'forehand', 'backhand', 'net_play', 'movement', 'mental_game'];
        console.log('Tennis skills coverage:');
        expectedSkills.forEach(skill => {
          const covered = answers.skills.hasOwnProperty(skill);
          console.log(`    ${covered ? '✅' : '❌'} ${skill}: ${covered ? 'SUBMITTED' : 'MISSING'}`);
        });
      }
    }

    console.log('\n✨ SUMMARY:');
    console.log(`📊 Total responses in database: ${responses.length}`);
    console.log(`🎯 Sports covered: ${sportsSubmitted.join(', ')}`);
    console.log(`💾 All responses have calculated ratings: ${responses.every(r => r.result) ? 'YES' : 'NO'}`);
    
  } catch (error) {
    console.error('Database query error:', error);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
