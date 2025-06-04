import OpenAI from "openai";
import FormData from "form-data";
import fs from "fs";
import path from "path";
import os from "os";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR || "default_key"
});

export interface ExtractedInteractionInfo {
  prospectName?: string;
  summary: string;
  category: string;
  subcategory: string;
  professionalInterests: string[];
  personalInterests: string[];
  philanthropicPriorities: string[];
  keyPoints: string[];
  suggestedAffinityTags: string[];
}

export async function transcribeAudio(audioData: string): Promise<string> {
  const maxRetries = 3;
  let lastError: Error = new Error("No attempts made");
  let tempFilePath: string | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Transcription attempt ${attempt}/${maxRetries}`);
      
      // Convert base64 to buffer for OpenAI API
      const audioBuffer = Buffer.from(audioData, 'base64');
      console.log(`Audio buffer size: ${audioBuffer.length} bytes`);
      
      // Create a temporary file
      tempFilePath = path.join(os.tmpdir(), `audio_${Date.now()}_${attempt}.wav`);
      fs.writeFileSync(tempFilePath, audioBuffer);
      
      const transcription = await openai.audio.transcriptions.create({
        file: await openai.toFile(fs.createReadStream(tempFilePath), 'audio.wav'),
        model: "whisper-1",
      });

      console.log(`Transcription successful: ${transcription.text.substring(0, 100)}...`);
      
      // Clean up temp file
      if (tempFilePath && fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
      
      return transcription.text;
    } catch (error) {
      lastError = error as Error;
      console.error(`Audio transcription error (attempt ${attempt}/${maxRetries}):`, error);
      
      // Clean up temp file on error
      if (tempFilePath && fs.existsSync(tempFilePath)) {
        try {
          fs.unlinkSync(tempFilePath);
        } catch (cleanupError) {
          console.error('Error cleaning up temp file:', cleanupError);
        }
      }
      
      // If this is a connection error and we have retries left, wait and try again
      if (attempt < maxRetries && (error as any)?.cause?.code === 'ECONNRESET') {
        console.log(`Retrying transcription in ${attempt * 2} seconds...`);
        await new Promise(resolve => setTimeout(resolve, attempt * 2000));
        continue;
      }
      
      // If all retries failed or it's not a connection error, throw
      break;
    }
  }

  throw new Error(`Failed to transcribe audio after ${maxRetries} attempts: ${lastError.message}`);
}

export async function extractInteractionInfo(transcript: string): Promise<ExtractedInteractionInfo> {
  try {
    const prompt = `
Analyze this fundraiser interaction transcript and extract structured information. 
Focus on identifying the prospect's professional interests, personal interests, and philanthropic priorities.
Also categorize the interaction type according to fundraising best practices.

Transcript: "${transcript}"

Please respond with JSON in exactly this format:
{
  "prospectName": "Name if mentioned, otherwise null",
  "summary": "Brief 1-2 sentence summary of the interaction",
  "category": "One of: Cultivation, Solicitation, Stewardship, Research",
  "subcategory": "One of: Initial Contact, Follow-up, Presentation, Social, Event, Meeting",
  "professionalInterests": ["array of professional interests mentioned"],
  "personalInterests": ["array of personal hobbies/interests mentioned"],
  "philanthropicPriorities": ["array of charitable causes/priorities mentioned"],
  "keyPoints": ["array of 3-5 key discussion points"],
  "suggestedAffinityTags": ["array of potential affinity tags based on interests"]
}
`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are an expert fundraising analyst who extracts structured information from donor interaction reports. Always respond with valid JSON."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });

    const result = JSON.parse(response.choices[0].message.content!);
    return result as ExtractedInteractionInfo;
  } catch (error) {
    console.error('Information extraction error:', error);
    throw new Error('Failed to extract interaction information: ' + (error as Error).message);
  }
}

export async function generateConciseSummary(transcript: string): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [
        {
          role: "system",
          content: "Create a concise summary of this interaction transcript in exactly 15 words or less. Focus on the key outcome or main point."
        },
        {
          role: "user", 
          content: transcript
        }
      ],
      max_tokens: 50,
      temperature: 0.3
    });

    return response.choices[0].message.content?.trim() || "Voice recording captured";
  } catch (error) {
    console.error("Summary generation error:", error);
    return "Voice recording captured";
  }
}

export async function generateInteractionSynopsis(
  transcript: string,
  extractedInfo: ExtractedInteractionInfo
): Promise<string> {
  try {
    const synopsisPrompt = `
Analyze this fundraising interaction and create a concise synopsis for Boston University's Advancement office. 

Format your response as:
1. First, write 2-3 sentences that summarize the overall interaction and strategic significance
2. Then provide bullet points covering:
   • Key interests and motivations discovered
   • Perceived donor capacity signals
   • Next steps or follow-up actions
   • Strategic cultivation opportunities

Transcript: ${transcript}

Key Information:
- Summary: ${extractedInfo.summary}
- Category: ${extractedInfo.category}
- Professional Interests: ${extractedInfo.professionalInterests.join(', ')}
- Personal Interests: ${extractedInfo.personalInterests.join(', ')}
- Philanthropic Priorities: ${extractedInfo.philanthropicPriorities.join(', ')}
- Key Points: ${extractedInfo.keyPoints.join(', ')}

Keep the narrative portion brief and focused - maximum 3 sentences before the bullet points.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [
        {
          role: "system",
          content: "You are an expert fundraising analyst helping Boston University's Advancement office understand the value and potential of donor interactions."
        },
        {
          role: "user",
          content: synopsisPrompt
        }
      ],
      max_tokens: 500,
      temperature: 0.3
    });

    return response.choices[0].message.content?.trim() || "Analysis not available";
  } catch (error) {
    console.error("Synopsis generation error:", error);
    return "Synopsis could not be generated";
  }
}

export async function enhanceInteractionComments(
  transcript: string, 
  extractedInfo: ExtractedInteractionInfo
): Promise<string> {
  try {
    // Generate comprehensive synopsis
    const synopsis = await generateInteractionSynopsis(transcript, extractedInfo);
    
    // Format the final comments with synopsis and transcript only
    const formattedComments = `ADVANCEMENT OFFICE SYNOPSIS:
${synopsis}

TRANSCRIPT:
${transcript}`;

    return formattedComments;
  } catch (error) {
    console.error("Comment enhancement error:", error);
    // Fallback format if AI processing fails
    return `ADVANCEMENT OFFICE SYNOPSIS:
Synopsis could not be generated due to processing error.

TRANSCRIPT:
${transcript}`;
  }
}
