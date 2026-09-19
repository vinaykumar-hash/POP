// =============================================================================
// ParkWise — Amazon Bedrock AI Client & Bengaluru Semantic Parser
// =============================================================================

import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from '@aws-sdk/client-bedrock-runtime';

const AWS_REGION = process.env.AWS_REGION || process.env.BEDROCK_REGION || 'us-east-1';
const BEDROCK_MODEL_ID = process.env.BEDROCK_MODEL_ID || 'anthropic.claude-3-haiku-20240307-v1:0';

const hasBedrockConfig = Boolean(
  process.env.AWS_ACCESS_KEY_ID &&
  process.env.AWS_SECRET_ACCESS_KEY &&
  (process.env.BEDROCK_MODEL_ID || process.env.ENABLE_AWS_BEDROCK === 'true')
);

let bedrockClient: BedrockRuntimeClient | null = null;
if (hasBedrockConfig) {
  try {
    bedrockClient = new BedrockRuntimeClient({ region: AWS_REGION });
  } catch (err) {
    console.warn('[ParkWise Bedrock] Client init failed, using local semantic fallback:', err);
  }
}

export interface ParsedParkingIntent {
  destination: string;
  type?: 'FREE' | 'PAID' | 'PUBLIC' | 'ALL';
  vehicleType?: 'TWO_WHEELER' | 'FOUR_WHEELER' | 'ANY';
  covered?: boolean;
  evCharging?: boolean;
  arrivalTime?: string; // HH:mm format (e.g. "20:00")
  arrivalHour?: number;  // 0 - 23
  reasoning: string;
  provider: 'amazon-bedrock' | 'bengaluru-semantic-engine';
}

const BENGALURU_LOCALITIES = [
  { name: 'MG Road', lat: 12.9756, lng: 77.6066 },
  { name: 'Brigade Road', lat: 12.9738, lng: 77.6074 },
  { name: 'Church Street', lat: 12.9751, lng: 77.6048 },
  { name: 'Commercial Street', lat: 12.9822, lng: 77.6083 },
  { name: 'Indiranagar', lat: 12.9784, lng: 77.6408 },
  { name: 'Koramangala', lat: 12.9352, lng: 77.6245 },
  { name: 'Cubbon Park', lat: 12.9764, lng: 77.5929 },
  { name: 'Whitefield', lat: 12.9698, lng: 77.7500 },
  { name: 'Jayanagar', lat: 12.9308, lng: 77.5838 },
  { name: 'Malleshwaram', lat: 13.0031, lng: 77.5644 },
  { name: 'HSR Layout', lat: 12.9121, lng: 77.6446 },
  { name: 'Shivajinagar', lat: 12.9857, lng: 77.6057 },
  { name: 'Majestic', lat: 12.9767, lng: 77.5713 },
  { name: 'Electronic City', lat: 12.8452, lng: 77.6602 },
];

/**
 * Parses free-form user query using Amazon Bedrock or local Bengaluru semantic engine
 */
export async function parseParkingPrompt(prompt: string): Promise<ParsedParkingIntent> {
  // 1. Try Amazon Bedrock if configured
  if (hasBedrockConfig && bedrockClient) {
    try {
      const systemPrompt = `You are the ParkWise AI Parking Assistant for Bengaluru, India.
Given the driver's query, extract a JSON object with:
- destination: locality/landmark name in Bengaluru
- type: 'FREE', 'PAID', 'PUBLIC', or 'ALL'
- vehicleType: 'TWO_WHEELER', 'FOUR_WHEELER', or 'ANY'
- covered: boolean or undefined
- evCharging: boolean or undefined
- arrivalTime: 'HH:mm' or undefined
- arrivalHour: integer 0-23 or undefined
- reasoning: 1-2 sentence friendly explanation of the parking conditions in Bengaluru for this scenario.
Return ONLY raw valid JSON, no markdown tags.`;

      const payload = {
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 300,
        system: systemPrompt,
        messages: [{ role: 'user', content: prompt }],
      };

      const command = new InvokeModelCommand({
        modelId: BEDROCK_MODEL_ID,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify(payload),
      });

      const response = await bedrockClient.send(command);
      const resJson = JSON.parse(new TextDecoder().decode(response.body));
      const text = resJson.content?.[0]?.text || '{}';
      const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanJson);

      return {
        ...parsed,
        provider: 'amazon-bedrock',
      };
    } catch (err) {
      console.warn('[ParkWise Bedrock] Model invocation failed, falling back to semantic engine:', err);
    }
  }

  // 2. High-Precision Local Bengaluru Semantic Parser
  return parseSemanticLocal(prompt);
}

/**
 * Local deterministic semantic parser calibrated for Bengaluru landmarks
 */
function parseSemanticLocal(prompt: string): ParsedParkingIntent {
  const lower = prompt.toLowerCase();

  // Locality extraction
  let matchedLocality = 'Bengaluru Central';
  for (const loc of BENGALURU_LOCALITIES) {
    if (lower.includes(loc.name.toLowerCase())) {
      matchedLocality = loc.name;
      break;
    }
  }

  // Pricing preference
  let parkingType: 'FREE' | 'PAID' | 'PUBLIC' | 'ALL' = 'ALL';
  if (lower.includes('free') || lower.includes('no fee') || lower.includes('zero cost')) {
    parkingType = 'FREE';
  } else if (lower.includes('paid') || lower.includes('mall') || lower.includes('commercial')) {
    parkingType = 'PAID';
  }

  // Vehicle type
  let vehicleType: 'TWO_WHEELER' | 'FOUR_WHEELER' | 'ANY' = 'FOUR_WHEELER';
  if (
    lower.includes('2 wheeler') ||
    lower.includes('two wheeler') ||
    lower.includes('bike') ||
    lower.includes('scooter') ||
    lower.includes('motorcycle')
  ) {
    vehicleType = 'TWO_WHEELER';
  } else if (
    lower.includes('car') ||
    lower.includes('suv') ||
    lower.includes('sedan') ||
    lower.includes('4 wheeler') ||
    lower.includes('four wheeler')
  ) {
    vehicleType = 'FOUR_WHEELER';
  }

  // Amenities
  const covered = lower.includes('covered') || lower.includes('basement') || lower.includes('shade') || lower.includes('roof');
  const evCharging = lower.includes('ev') || lower.includes('charging') || lower.includes('electric');

  // Arrival hour detection
  let arrivalHour = new Date().getHours();
  let arrivalTime = `${arrivalHour.toString().padStart(2, '0')}:00`;

  const timeMatch = prompt.match(/(\d{1,2})\s*(pm|am|p\.m\.|a\.m\.)/i);
  if (timeMatch) {
    let hour = parseInt(timeMatch[1], 10);
    const meridian = timeMatch[2].toLowerCase();
    if (meridian.startsWith('p') && hour < 12) hour += 12;
    if (meridian.startsWith('a') && hour === 12) hour = 0;
    arrivalHour = hour;
    arrivalTime = `${hour.toString().padStart(2, '0')}:00`;
  } else if (lower.includes('night') || lower.includes('evening') || lower.includes('tonight')) {
    arrivalHour = 20;
    arrivalTime = '20:00';
  } else if (lower.includes('morning')) {
    arrivalHour = 10;
    arrivalTime = '10:00';
  }

  // Bengaluru-specific contextual advice
  let advice = `Identified parking request for ${matchedLocality}.`;
  if (arrivalHour >= 18 && arrivalHour <= 21) {
    advice = `Around ${arrivalTime}, ${matchedLocality} experiences peak commercial traffic. We prioritized parking spaces with surveyed capacity and good turnover.`;
  } else if (arrivalHour < 12) {
    advice = `Morning arrival around ${arrivalTime} in ${matchedLocality} typically offers lower occupancy and easier spot finding.`;
  }

  if (parkingType === 'FREE') {
    advice += ` Filtering for free on-street and open municipal lots.`;
  }

  return {
    destination: matchedLocality,
    type: parkingType,
    vehicleType,
    covered: covered ? true : undefined,
    evCharging: evCharging ? true : undefined,
    arrivalTime,
    arrivalHour,
    reasoning: advice,
    provider: 'bengaluru-semantic-engine',
  };
}

export function isBedrockActive(): boolean {
  return hasBedrockConfig && bedrockClient !== null;
}
