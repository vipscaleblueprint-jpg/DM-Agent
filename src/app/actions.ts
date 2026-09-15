'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export async function getLeads(clientId: string, productId?: string) {
  let whereClause: any = { client_id: clientId };
  if (productId) {
    whereClause.product_id = productId;
  }
  const leads = await prisma.lead.findMany({
    where: whereClause,
    orderBy: { createdAt: 'desc' },
    include: {
      LeadState: true,
      Conversation: {
        orderBy: { createdAt: 'desc' },
        take: 1
      }
    }
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

export async function getClients() {
  const clients = await prisma.client.findMany({
    orderBy: { createdAt: 'asc' },
    include: { Product: true }
  });
  return clients;
}

export async function addClient(name: string) {
  if (!name.trim()) return { success: false, error: 'Name is required' };
  try {
    const client = await prisma.client.create({
      data: {
        id: `client_${Date.now()}`,
        name: name.trim(),
        updatedAt: new Date(),
      }
    });
    revalidatePath('/');
    return { success: true, client };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function editClient(id: string, name: string) {
  if (!name.trim()) return { success: false, error: 'Name is required' };
  try {
    const client = await prisma.client.update({
      where: { id },
      data: {
        name: name.trim(),
        updatedAt: new Date(),
      }
    });
    revalidatePath('/');
    return { success: true, client };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getClientStage(clientId: string, stageOrder: number) {
  const stage = await prisma.clientStage.findFirst({
    where: { client_id: clientId, stageOrder }
  });
  // Serialize BigInt safely just in case, though there are no BigInts in ClientStage usually
  return JSON.parse(JSON.stringify(stage));
}

export async function getClientStages(clientId: string) {
  const stages = await prisma.clientStage.findMany({
    where: { client_id: clientId },
    orderBy: { stageOrder: 'asc' }
  });
  return JSON.parse(JSON.stringify(stages));
}

export async function saveClientStages(clientId: string, stages: any[]) {
  // First, delete existing stages for this client
  await prisma.clientStage.deleteMany({
    where: { client_id: clientId }
  });

  // Then create new ones
  for (const stage of stages) {
    await prisma.clientStage.create({
      data: {
        client_id: clientId,
        stageOrder: stage.stageOrder,
        stageName: stage.stageName,
        systemPrompt: stage.systemPrompt,
        checklistConfig: stage.checklistConfig || []
      }
    });
  }
  revalidatePath('/');
  return { success: true };
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
  const lead = await prisma.lead.findUnique({ 
    where: { id: leadId },
    include: { Product: true }
  });
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
${await getPromptForStage(stage, clientId)}

Current Time: ${simulatedTime || new Date().toISOString()}

Current Lead Profile:
Name: ${lead?.name || 'Unknown'}
Stage: ${stage} (${stageName})
Assessment Data Captured So Far:
${JSON.stringify(leadState?.assessmentData || {}, null, 2)}

${lead?.Product ? `PRODUCT CONTEXT (Keep this specific product in mind while responding):\nProduct Name: ${lead.Product.product_name}\nValue Proposition (VPS): ${lead.Product.vps || 'None provided'}\nTarget Persona: ${lead.Product.persona || 'None provided'}\n` : ''}

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
        connection_level: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional().describe('Connection level built so far'),
        stage_ready_for_promotion: z.boolean().describe('Are they ready to advance to the next stage based on exit conditions?'),
        reason: z.string().describe('Brief explanation for stage promotion decision'),
        next_stage: z.number().describe('The stage they should be in next'),
        summary: z.string().optional().describe('Brief summary of what we know about the lead so far'),
        assessment_updates: z.record(z.string(), z.any()).describe('A dictionary updating any dynamic checklist keys for this stage. Key is the checklist item ID, value is the updated value (e.g. boolean, string).')
      }),
    });

    const resolveStageName = async (num: number, currentName: string, clientId: string) => {
      const st = await prisma.clientStage.findFirst({ where: { client_id: clientId, stageOrder: num } });
      if (st) return st.stageName;
      return currentName;
    };

    // 4. Update the LeadState based on LLM output
    const currentAssessmentData = leadState?.assessmentData ? JSON.parse(JSON.stringify(leadState.assessmentData)) : {};
    const newAssessmentData = { ...currentAssessmentData, ...(object.assessment_updates || {}) };

    await prisma.leadState.update({
      where: { lead_id: leadId },
      data: {
        stage: object.next_stage,
        stageName: await resolveStageName(object.next_stage, object.stage_name, clientId),
        connectionLevel: object.connection_level === 'LOW' || object.connection_level === 'MEDIUM' || object.connection_level === 'HIGH' ? object.connection_level : undefined,
        lastStageChangeReason: object.reason,
        leadSummary: object.summary,
        assessmentData: newAssessmentData,
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

export async function deleteMessage(messageId: string) {
  try {
    await prisma.conversation.delete({ where: { id: BigInt(messageId) } });
    revalidatePath('/');
    return { success: true };
  } catch (error: any) {
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

export async function addLead(name: string, fbLink?: string, clientId?: string) {
  const leadId = `lead_${Date.now()}`;
  
  let targetClientId = clientId;
  if (!targetClientId) {
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
    targetClientId = client.id;
  }

  await prisma.lead.create({
    data: {
      id: leadId,
      name,
      fb_link: fbLink || null,
      client_id: targetClientId,
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

export async function getPromptForStage(stage: number, clientId: string) {
  const clientStage = await prisma.clientStage.findFirst({
    where: { client_id: clientId, stageOrder: stage }
  });
  
  if (clientStage && clientStage.systemPrompt) {
    return clientStage.systemPrompt;
  }
  
  // Fallback if no stage config is found
  return "You are an AI sales assistant. Guide the user through the sales process.";
}

export async function editLead(leadId: string, name: string, fbLink?: string) {
  await prisma.lead.update({
    where: { id: leadId },
    data: {
      name,
      fb_link: fbLink || null,
      updatedAt: new Date()
    }
  });
  revalidatePath('/');
}

export async function removeLead(leadId: string) {
  await prisma.conversation.deleteMany({ where: { lead_id: leadId } });
  await prisma.stageTransition.deleteMany({ where: { lead_id: leadId } });
  await prisma.leadState.deleteMany({ where: { lead_id: leadId } });
  await prisma.lead.delete({ where: { id: leadId } });
  revalidatePath('/');
}

export async function editConversationMessage(msgIdStr: string, newContent: string) {
  await prisma.conversation.update({
    where: { id: BigInt(msgIdStr) },
    data: { content: newContent }
  });
  revalidatePath('/');
}

export async function learnFromCorrection(clientId: string, originalContent: string, newContent: string) {
  if (!process.env.API_KEY) return { success: false, error: 'API_KEY not set' };
  
  const systemPrompt = `You are an AI teaching assistant. The user just corrected a drafted DM response.
Original AI Draft:
"${originalContent}"

User's Corrected Version:
"${newContent}"

Extract ONE highly concise, generalized rule (1-2 sentences max) that the AI should follow for future messages so it doesn't make the same mistake.
Do not refer to the specific lead. Frame it as a direct instruction to the AI.`;

  try {
    const { object } = await generateObject({
      model: google('gemini-3.7-flash'),
      system: systemPrompt,
      messages: [{ role: 'user', content: 'Extract rule' }],
      schema: z.object({
        rule: z.string().describe('The extracted rule to learn from this correction')
      })
    });

    const ruleText = `\n\n[LEARNED RULE]: ${object.rule}`;
    
    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (client) {
      await prisma.client.update({
        where: { id: clientId },
        data: { 
          context: (client.context || '') + ruleText,
          updatedAt: new Date()
        }
      });
      revalidatePath('/');
      return { success: true, rule: object.rule };
    }
    return { success: false, error: 'Client not found' };
  } catch (error: any) {
    console.error('Learning Error:', error);
    return { success: false, error: error.message };
  }
}

export async function syncClientsFromWebhook() {
  try {
    const response = await fetch("https://n8n.heysnaply.com/webhook/clients/vps-2", {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch from webhook: ${response.statusText}`);
    }
    
    const rawData = await response.json();
    if (!Array.isArray(rawData)) {
      throw new Error("Webhook returned invalid format, expected array.");
    }
    
    // Grouping by clean name
    const groupedClients: Record<string, string[]> = {};
    
    for (const item of rawData) {
      if (!item.client) continue;
      
      const cleanName = item.client
        .replace(/^admin\s*\|\s*/i, "")
        .replace(/\s*\|\s*personal\s*$/i, "")
        .replace(/\s*\([^)]*\)\s*$/, "")
        .trim();
        
      const match = item.client.match(/\(([^)]+)\)/);
      const derivedProduct = match ? match[1] : "";
      
      const productName = item.product || derivedProduct || "Main Package";
      const vpsLink = item.vps || "";
      
      if (!groupedClients[cleanName]) {
        groupedClients[cleanName] = [];
      }
      
      if (vpsLink) {
        groupedClients[cleanName].push(`- Product: ${productName} | VPS: ${vpsLink}`);
      }
    }
    
    // Upsert clients
    let syncedCount = 0;
    for (const [cleanName, vpsList] of Object.entries(groupedClients)) {
      if (vpsList.length === 0) continue;
      
      const vpsText = `VPS Links:\n${vpsList.join('\n')}`;
      
      // Find existing client by name
      const existingClient = await prisma.client.findFirst({
        where: { name: cleanName }
      });
      
      if (existingClient) {
        const currentContext = existingClient.context || "";
        let newContext = currentContext;
        
        // Clean out old VPS links block if it exists
        if (currentContext.includes("VPS Links:")) {
          newContext = currentContext.replace(/VPS Links:[\s\S]*?(?=\n\n|$)/, "").trim();
        }
        
        await prisma.client.update({
          where: { id: existingClient.id },
          data: {
            context: `${vpsText}\n\n${newContext}`.trim(),
            updatedAt: new Date()
          }
        });
      } else {
        await prisma.client.create({
          data: {
            id: `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: cleanName,
            context: vpsText,
            updatedAt: new Date()
          }
        });
      }
      syncedCount++;
    }
    
    revalidatePath('/');
    return { success: true, count: syncedCount };
    
  } catch (err: any) {
    console.error('Webhook Sync Error:', err);
    return { success: false, error: err.message };
  }
}

export async function syncVipscaleClients() {
  try {
    const apiKey = process.env.VIPSCALE_API_KEY_SECRET;
    if (!apiKey) throw new Error("Missing VIPSCALE_API_KEY_SECRET in .env");

    const toolsUrl = process.env.VIPSCALE_TOOLS_URL || "https://tools.vipscaleph.com";
    const response = await fetch(`${toolsUrl}/api/clients`, {
      method: "GET",
      headers: {
        "x-api-key": apiKey 
      },
      cache: "no-store",
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch from VIPScale: ${response.statusText}`);
    }
    
    const data = await response.json();
    const clients = data.clients || [];
    
    let syncedCount = 0;
    for (const item of clients) {
      const clientName = item.name || item.client || "Unknown Client";
      
      const existingClient = await prisma.client.findFirst({
        where: { name: clientName }
      });
      
      let clientId;
      if (existingClient) {
        clientId = existingClient.id;
        await prisma.client.update({
          where: { id: existingClient.id },
          data: {
            updatedAt: new Date()
          }
        });
      } else {
        const newClient = await prisma.client.create({
          data: {
            id: `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: clientName,
            updatedAt: new Date()
          }
        });
        clientId = newClient.id;
      }

      // Sync Products
      if (item.products && Array.isArray(item.products)) {
        for (const prod of item.products) {
          const prodName = prod.product_name || "Unknown Product";
          
          const existingProd = await prisma.product.findFirst({
            where: { client_id: clientId, product_name: prodName }
          });

          if (existingProd) {
            await prisma.product.update({
              where: { id: existingProd.id },
              data: {
                vps: prod.vps || null,
                persona: prod.persona || null,
                updatedAt: new Date()
              }
            });
          } else {
            await prisma.product.create({
              data: {
                id: `prod_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                client_id: clientId,
                product_name: prodName,
                vps: prod.vps || null,
                persona: prod.persona || null,
                updatedAt: new Date()
              }
            });
          }
        }
      }

      syncedCount++;
    }
    
    revalidatePath('/');
    return { success: true, count: syncedCount };
    
  } catch (err: any) {
    console.error('VIPScale Sync Error:', err);
    return { success: false, error: err.message };
  }
}
