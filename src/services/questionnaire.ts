// src/services/questionnaire.ts
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

type Sport = 'pickleball'|'tennis'|'padel';

export function loadQuestionnaire(sport: Sport) {
  const fp = path.resolve(__dirname, '../data/questionnaires', `${sport}-questionnaire.v1.json`);
  const raw = fs.readFileSync(fp, 'utf8');
  const def = JSON.parse(raw);
  const qHash = crypto.createHash('sha1').update(raw).digest('hex');
  const version = def.version as number;
  return { def, qHash, version };
}
