import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
  const clients = await prisma.client.findMany();
  if (clients.length === 0) {
    console.log("No clients found to migrate to.");
    return;
  }
  
  const client = clients[0]; // Assuming the first client is Melinda's default client

  // Delete existing stages to start fresh
  await prisma.clientStage.deleteMany({
    where: { client_id: client.id }
  });

  for (let i = 1; i <= 6; i++) {
    const filePath = path.join(process.cwd(), `src/prompts/stage${i}.ts`);
    if (!fs.existsSync(filePath)) {
      console.log(`Warning: ${filePath} not found, skipping.`);
      continue;
    }

    const content = fs.readFileSync(filePath, 'utf8');
    
    // Naive extraction: removing export const stageXPrompt = ` and the trailing `
    let systemPrompt = content;
    const match = content.match(/export const stage\dPrompt = `([\s\S]*?)`;/);
    if (match) {
      systemPrompt = match[1];
    } else {
       // fallback, just take everything after the first backtick
       const parts = content.split('`');
       if (parts.length >= 3) {
           systemPrompt = parts.slice(1, -1).join('`');
       }
    }

    // Assign appropriate checklists based on the hardcoded logic we used to have
    let checklistConfig: any[] = [];
    let stageName = `Stage ${i}`;
    
    if (i === 1) {
      stageName = 'getting_to_know';
      checklistConfig = [
        { id: 'basic_rapport_captured', label: 'Basic Rapport & Context', type: 'boolean' },
        { id: 'current_situation_captured', label: 'Current Situation & Prompt', type: 'boolean' },
        { id: 'frustrations_captured', label: 'Frustrations & Desired Change', type: 'boolean' },
        { id: 'prior_exploration_captured', label: 'Prior Exploration', type: 'boolean' }
      ];
    } else if (i === 2) {
      stageName = 'curiosity';
    } else if (i === 3) {
      stageName = 'interest';
      checklistConfig = [
        { id: 'quiz_offered', label: 'Quiz Offered', type: 'boolean' },
        { id: 'quiz_accepted', label: 'Quiz Accepted', type: 'boolean' },
        { id: 'quiz_completed', label: 'Quiz Completed', type: 'boolean' },
        { id: 'quiz_result', label: 'Quiz Result', type: 'string' }
      ];
    } else if (i === 4) {
      stageName = 'engagement';
      checklistConfig = [
        { id: 'masterclass_offered', label: 'Masterclass Offered', type: 'boolean' },
        { id: 'masterclass_engagement', label: 'Masterclass Engagement', type: 'string' }
      ];
    } else if (i === 5) {
      stageName = 'authority_and_desire';
    } else if (i === 6) {
      stageName = 'decision';
      checklistConfig = [
        { id: 'offer_introduced', label: 'Offer Introduced', type: 'boolean' },
        { id: 'offer_interest', label: 'Offer Interest', type: 'string' },
        { id: 'objection', label: 'Objection', type: 'string' },
        { id: 'decision_status', label: 'Decision Status', type: 'string' }
      ];
    }

    await prisma.clientStage.create({
      data: {
        client_id: client.id,
        stageOrder: i,
        stageName,
        systemPrompt: systemPrompt.trim(),
        checklistConfig: checklistConfig
      }
    });

    console.log(`Migrated Stage ${i}`);
  }

  console.log("Migration complete.");
}

main().catch(console.error).finally(() => prisma.$disconnect());
