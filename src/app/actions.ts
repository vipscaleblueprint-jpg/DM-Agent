'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { stage1Prompt } from '@/prompts/stage1';
import { stage2Prompt } from '@/prompts/stage2';
import { stage3Prompt } from '@/prompts/stage3';
import { stage4Prompt } from '@/prompts/stage4';
import { stage5Prompt } from '@/prompts/stage5';
import { stage6Prompt } from '@/prompts/stage6';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export async function getLeads() {
  const leads = await prisma.lead.findMany({
    orderBy: { updatedAt: 'desc' },
    include: {
      Client: true,
      LeadState: true,
      Conversation: {
        orderBy: { createdAt: 'asc' },
      },
    },
  });
  
  // Serialize BigInt safely
  return JSON.parse(JSON.stringify(leads, (key, value) =>
    typeof value === 'bigint' ? value.toString() : value
  ));
}

export async function getLeadDetails(leadId: string) {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: {
      Client: true,
      LeadState: true,
      Conversation: {
        orderBy: { createdAt: 'asc' }
      }
    }
  });

  // Serialize BigInt safely
  return JSON.parse(JSON.stringify(lead, (key, value) =>
    typeof value === 'bigint' ? value.toString() : value
  ));
}

export async function addBulkConversation(leadId: string, content: string) {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) throw new Error('Lead not found');

  await prisma.conversation.create({
    data: {
      lead_id: leadId,
      role: 'user',
      content,
    },
  });

  revalidatePath('/');
}

import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { z } from 'zod';

const google = createGoogleGenerativeAI({
  apiKey: process.env.API_KEY || ''
});

export async function sendLeadMessage(leadId: string, text: string) {
  if (!text.trim()) return;
  await prisma.conversation.create({
    data: {
      lead_id: leadId,
      role: 'user',
      content: text,
    }
  });
  revalidatePath('/');
}

export async function getGlobalClient() {
  let client = await prisma.client.findFirst();
  if (!client) {
    client = await prisma.client.create({
      data: {
        id: `client_${Date.now()}`,
        name: 'Business Owner',
        updatedAt: new Date(),
      }
    });
  }
  return client;
}

export async function saveClientContext(clientId: string | null, contextText: string) {
  let id = clientId;
  if (!id) {
    const client = await getGlobalClient();
    id = client.id;
  }

  await prisma.client.update({
    where: { id: id },
    data: { 
      context: contextText,
      updatedAt: new Date()
    }
  });
  revalidatePath('/');
}

export async function generateDraftResponse(leadId: string, clientId: string, simulatedTime?: string) {
  if (!process.env.API_KEY) {
    return { success: false, error: 'API_KEY is not set in .env' };
  }

  // 2. Retrieve history and state
  const leadState = await prisma.leadState.findUnique({ where: { lead_id: leadId } });
  const client = await prisma.client.findUnique({ where: { id: clientId } });
  const conversations = await prisma.conversation.findMany({
    where: { lead_id: leadId },
    orderBy: { createdAt: 'asc' },
  });

  let chatHistoryStr = conversations.map(c => `[${c.createdAt.toISOString()}] ${c.role.toUpperCase()}: ${c.content}`).join('\n\n');

  if (conversations.length > 0 && conversations[conversations.length - 1].role === 'assistant') {
    chatHistoryStr += `\n\n[SYSTEM NOTE]: The lead has NOT responded to your last message. The current time is now ${simulatedTime || new Date().toISOString()}. Follow the guidelines for unanswered messages.`;
  }
  // 3. Define the LLM instruction and schema
  const stage = leadState?.stage || 1;
  const stageName = leadState?.stageName || 'getting_to_know';

  const systemPrompt = `
${await getPromptForStage(stage)}

Current Time: ${simulatedTime || new Date().toISOString()}

Current Lead Profile:
Stage: ${stage} (${stageName})
Current Situation: ${leadState?.currentSituation || 'Unknown'}
Pain Point: ${leadState?.painPoint || 'Unknown'}
Goal: ${leadState?.goal || 'Unknown'}
Desired Future: ${leadState?.desiredFuture || 'Unknown'}
Core Problem: ${leadState?.coreProblem || 'Unknown'}

${client?.context ? `EXTRA CONTEXT (Client Product/Business Rules):\n${client.context}\n\nStrictly follow this context.` : ''}

Output JSON according to the schema.
`;

  const assetUrls = client?.context ? Array.from(client.context.matchAll(/https:\/\/[^\s]+/g)).map(m => m[0]) : [];
  const promptParts: any[] = [{ type: 'text', text: `Chat History:\n${chatHistoryStr}` }];
  
  for (const url of assetUrls) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const base64 = buffer.toString('base64');
        
        if (url.match(/\.(jpeg|jpg|png|webp|gif)$/i)) {
          promptParts.push({ type: 'image', image: base64 });
        } else if (url.match(/\.(pdf)$/i)) {
          promptParts.push({ type: 'file', data: base64, mediaType: 'application/pdf' });
        }
      }
    } catch (e) {
      console.error('Failed to fetch asset from R2', url, e);
    }
  }

  try {
    const { object } = await generateObject({
      model: google('gemini-3.7-flash'),
      system: systemPrompt,
      messages: [{ role: 'user', content: promptParts }],
      schema: z.object({
        drafted_response: z.string().describe('The natural DM response to send to the lead'),
        stage: z.number().describe('The current stage number'),
        stage_name: z.string().describe('Name of the stage'),
        primary_intent: z.enum(['wealth', 'time_freedom', 'additional_income', 'career_change', 'identity', 'ownership', 'fulfillment', 'clarity', 'legacy', 'other', 'unknown']).optional().describe('The primary intent identified'),
        current_situation: z.string().optional().describe('Brief summary of current situation'),
        goal: z.string().optional().describe('Brief summary of their goal'),
        pain_point: z.string().optional().describe('Brief summary of their pain point'),
        desired_future: z.string().optional().describe('Brief summary of their desired future'),
        connection_level: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional().describe('Connection level built so far'),
        core_problem: z.string().optional().describe('The identified core problem'),
        insight_given: z.string().optional().describe('The insight given to the lead'),
        lead_reaction: z.string().optional().describe('How the lead reacted to the insight'),
        curiosity_level: z.enum(['low', 'medium', 'high', 'LOW', 'MEDIUM', 'HIGH']).optional().describe('Level of curiosity'),
        quiz_offered: z.boolean().optional().describe('Has the quiz been offered?'),
        quiz_accepted: z.boolean().optional().describe('Has the lead accepted the quiz?'),
        quiz_completed: z.boolean().optional().describe('Has the lead completed the quiz?'),
        quiz_result: z.string().optional().describe('The result of the quiz'),
        result_interpretation: z.string().optional().describe('How the result was interpreted'),
        deeper_goal: z.string().optional().describe('A deeper goal discovered in Stage 4'),
        desire_level: z.enum(['low', 'medium', 'high', 'LOW', 'MEDIUM', 'HIGH']).optional().describe('Level of desire'),
        masterclass_offered: z.boolean().optional().describe('Has the masterclass been offered?'),
        masterclass_engagement: z.string().optional().describe('Engagement with the masterclass'),
        belief_level: z.enum(['low', 'medium', 'high', 'LOW', 'MEDIUM', 'HIGH']).optional().describe('Level of belief'),
        offer_introduced: z.boolean().optional().describe('Has the paid offer been introduced?'),
        offer_interest: z.string().optional().describe('Level of interest in the offer'),
        objection: z.string().optional().describe('Any stated objection to the offer'),
        decision_status: z.string().optional().describe('Status of the decision (e.g. considering, purchased)'),
        next_action: z.string().optional().describe('Next action to take with the lead'),
        stage_ready_for_promotion: z.boolean().describe('Are they ready to advance to the next stage based on exit conditions?'),
        reason: z.string().describe('Brief explanation for stage promotion decision'),
        next_stage: z.number().describe('The stage they should be in next')
      }),
    });

    const resolveStageName = (num: number, currentName: string) => {
      switch(num) {
        case 1: return 'getting_to_know';
        case 2: return 'curiosity';
        case 3: return 'interest';
        case 4: return 'engagement';
        case 5: return 'authority_and_desire';
        case 6: return 'decision';
        default: return currentName;
      }
    };

    // 4. Update the LeadState based on LLM output
    await prisma.leadState.update({
      where: { lead_id: leadId },
      data: {
        stage: object.next_stage,
        stageName: resolveStageName(object.next_stage, object.stage_name),
        currentSituation: object.current_situation,
        painPoint: object.pain_point,
        goal: object.goal,
        desiredFuture: object.desired_future,
        coreProblem: object.core_problem,
        insightGiven: object.insight_given,
        leadReaction: object.lead_reaction,
        curiosityLevel: object.curiosity_level,
        connectionLevel: object.connection_level === 'LOW' || object.connection_level === 'MEDIUM' || object.connection_level === 'HIGH' ? object.connection_level : undefined,
        quizOffered: object.quiz_offered,
        quizAccepted: object.quiz_accepted,
        quizCompleted: object.quiz_completed,
        quizResult: object.quiz_result,
        resultInterpretation: object.result_interpretation,
        deeperGoal: object.deeper_goal,
        desireLevel: object.desire_level,
        masterclassOffered: object.masterclass_offered,
        masterclassEngagement: object.masterclass_engagement,
        beliefLevel: object.belief_level,
        offerIntroduced: object.offer_introduced,
        offerInterest: object.offer_interest,
        objection: object.objection,
        decisionStatus: object.decision_status,
        nextAction: object.next_action,
        lastStageChangeReason: object.reason,
        updatedAt: new Date()
      }
    });

    // 5. Save the generated draft as assistant message so it shows in history
    await prisma.conversation.create({
      data: {
        lead_id: leadId,
        role: 'assistant',
        content: object.drafted_response,
      }
    });

    revalidatePath('/');
    return { success: true, response: object.drafted_response };

  } catch (error: any) {
    console.error('LLM Error:', error);
    return { success: false, error: error.message };
  }
}

export async function getPresignedUrl(filename: string, contentType: string) {
  const accountId = process.env.R2_ACCOUNT_ID;
  if (!accountId) {
    return { error: 'R2_ACCOUNT_ID not configured in .env' };
  }

  const s3Client = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
    },
  });

  const command = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME || 'dm-agent-assets',
    Key: `uploads/${Date.now()}-${filename}`,
    ContentType: contentType,
  });

  try {
    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
    return { signedUrl, fileUrl: command.input.Key };
  } catch (err: any) {
    console.error('Error generating presigned URL:', err);
    return { error: err.message };
  }
}

export async function uploadFileToR2(formData: FormData) {
  const file = formData.get('file') as File;
  if (!file) return { error: 'No file provided' };

  const accountId = process.env.R2_ACCOUNT_ID;
  if (!accountId) return { error: 'R2_ACCOUNT_ID not configured in .env' };

  const s3Client = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
    },
  });

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const key = `uploads/${Date.now()}-${file.name.replace(/\s+/g, '_')}`;

  const command = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME || 'dm-agent-assets',
    Key: key,
    ContentType: file.type,
    Body: buffer,
  });

  try {
    await s3Client.send(command);
    return { fileUrl: key };
  } catch (err: any) {
    console.error('Error uploading to R2:', err);
    return { error: err.message };
  }
}

export async function addLead(name: string, fbLink?: string) {
  const leadId = `lead_${Date.now()}`;
  
  let client = await prisma.client.findFirst();
  if (!client) {
    client = await prisma.client.create({
      data: {
        id: `client_${Date.now()}`,
        name: 'Business Owner',
        updatedAt: new Date(),
      }
    });
  }

  await prisma.lead.create({
    data: {
      id: leadId,
      name,
      fb_link: fbLink || null,
      client_id: client.id,
      updatedAt: new Date(),
      LeadState: {
        create: {
          stage: 1,
          stageName: "getting_to_know",
          updatedAt: new Date(),
        }
      }
    }
  });

  revalidatePath('/');
  return leadId;
}

export async function getPromptForStage(stage: number) {
  switch (stage) {
    case 1: return stage1Prompt;
    case 2: return stage2Prompt;
    case 3: return stage3Prompt;
    case 4: return stage4Prompt;
    case 5: return stage5Prompt;
    case 6: return stage6Prompt;
    default: return stage1Prompt;
  }
}
