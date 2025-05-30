import OpenAI from "openai";

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
  try {
    // Convert base64 to buffer for OpenAI API
    const audioBuffer = Buffer.from(audioData, 'base64');
    
    // Create a temporary file-like object
    const audioFile = new File([audioBuffer], 'audio.wav', { type: 'audio/wav' });
    
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: "whisper-1",
    });

    return transcription.text;
  } catch (error) {
    console.error('Audio transcription error:', error);
    throw new Error('Failed to transcribe audio: ' + (error as Error).message);
  }
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

export async function enhanceInteractionComments(
  transcript: string, 
  extractedInfo: ExtractedInteractionInfo
): Promise<string> {
  try {
    // Generate a single paragraph summary
    const summaryPrompt = `
Create a single paragraph summary (2-3 sentences) of this fundraising interaction transcript that captures the key outcomes, commitments, and next steps in a professional tone suitable for a CRM system.

Transcript: ${transcript}

Key Information:
- Summary: ${extractedInfo.summary}
- Category: ${extractedInfo.category}
- Professional Interests: ${extractedInfo.professionalInterests.join(', ')}
- Personal Interests: ${extractedInfo.personalInterests.join(', ')}
- Philanthropic Priorities: ${extractedInfo.philanthropicPriorities.join(', ')}
- Key Points: ${extractedInfo.keyPoints.join(', ')}

Provide only the summary paragraph, no additional formatting.`;

    const summaryResponse = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [
        {
          role: "system",
          content: "You are a professional fundraising documentation assistant. Create concise, professional summaries for CRM interaction records."
        },
        {
          role: "user",
          content: summaryPrompt
        }
      ],
      max_tokens: 200,
      temperature: 0.3
    });

    const summary = summaryResponse.choices[0].message.content?.trim() || "Interaction summary not available.";
    
    // Format the final comments with clear separation
    const formattedComments = `SUMMARY:
${summary}

TRANSCRIPT:
${transcript}`;

    return formattedComments;
  } catch (error) {
    console.error("Comment enhancement error:", error);
    // Fallback format if AI processing fails
    return `SUMMARY:
Voice recording captured during interaction.

TRANSCRIPT:
${transcript}`;
  }
}
