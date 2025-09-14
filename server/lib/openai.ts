import OpenAI from "openai";
import FormData from "form-data";
import fetch from "node-fetch";
import fs from "fs";
import path from "path";
import os from "os";

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR || "default_key"
});

export interface ExtractedInteractionInfo {
  prospectName?: string;
  summary: string;
  category: string;
  subcategory: string;
  contactLevel: string;
  professionalInterests: string[];
  personalInterests: string[];
  philanthropicPriorities: string[];
  keyPoints: string[];
  suggestedAffinityTags: string[];
}

export interface InteractionQualityAssessment {
  qualityScore: number; // 0-25 based on rubric
  qualityExplanation: string; // Detailed explanation of score
  categoryScores: {
    completeness: number; // out of 5
    relationshipInsights: number; // out of 5
    strategicAssessment: number; // out of 5
    communicationEffectiveness: number; // out of 5
    followupPotential: number; // out of 5
    bonusPoints: number; // out of 5
  };
  recommendations: string[]; // Specific actionable recommendations for improvement
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
      
      // Create form data with the audio buffer
      const form = new FormData();
      form.append('file', audioBuffer, {
        filename: 'audio.wav',
        contentType: 'audio/wav'
      });
      form.append('model', 'whisper-1');
      
      // Make direct API call to OpenAI transcription endpoint
      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          ...form.getHeaders()
        },
        body: form as any
      });
      
      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
      }
      
      const result = await response.json() as { text: string };
      const transcription = { text: result.text };

      console.log(`Transcription successful: ${transcription.text.substring(0, 100)}...`);
      
      return transcription.text;
    } catch (error) {
      lastError = error as Error;
      console.error(`Audio transcription error (attempt ${attempt}/${maxRetries}):`, error);
      
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
    console.log("🤖 Starting OpenAI extraction...");
    console.log("Transcript being analyzed:", transcript.substring(0, 200) + (transcript.length > 200 ? '...' : ''));
    
    const prompt = `
Analyze this fundraiser interaction transcript and extract structured information. 
Focus on identifying the prospect's professional interests, personal interests, and philanthropic priorities.
Also categorize the interaction type according to fundraising best practices.

IMPORTANT: Even if the transcript appears to be singing, humming, or casual conversation, treat it as a legitimate fundraising interaction and extract any useful information. Do not dismiss content as "test message" - always provide meaningful analysis.

Be precise and extract interests that are mentioned or can be reasonably implied from the conversation.

Transcript: "${transcript}"

Please respond with JSON in exactly this format:
{
  "prospectName": "Name if mentioned, otherwise null",
  "summary": "Brief 1-2 sentence summary of the interaction",
  "category": "One of: Cultivation, Solicitation, Stewardship, Research",
  "subcategory": "One of: Initial Contact, Follow-up, Presentation, Social, Event, Meeting",
  "professionalInterests": ["array of professional interests explicitly mentioned"],
  "personalInterests": ["array of personal hobbies/interests explicitly mentioned"],
  "philanthropicPriorities": ["array of charitable causes/priorities explicitly mentioned"],
  "keyPoints": ["array of 3-5 key discussion points"],
  "suggestedAffinityTags": []
}

Important: Leave suggestedAffinityTags as an empty array. The system will match interests to available affinity tags automatically.
`;

    const response = await openai.chat.completions.create({
      model: "gpt-5",
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
      temperature: 0.3
    }, {
      timeout: 12000 // 12 second timeout
    });

    console.log("✅ OpenAI extraction completed");
    const result = JSON.parse(response.choices[0].message.content!);
    return result as ExtractedInteractionInfo;
  } catch (error) {
    console.error('❌ Information extraction error:', error);
    // Return a fallback response instead of throwing
    return {
      prospectName: "Voice Recording", 
      summary: `Voice interaction recorded: ${transcript.substring(0, 100)}${transcript.length > 100 ? '...' : ''}`,
      category: "Cultivation",
      subcategory: "Follow-up",
      contactLevel: "Follow-up",
      professionalInterests: [],
      personalInterests: [],
      philanthropicPriorities: [],
      keyPoints: [transcript.length > 80 ? transcript.substring(0, 80) + "..." : transcript],
      suggestedAffinityTags: []
    };
  }
}

export async function generateConciseSummary(transcript: string): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5", // the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
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
  extractedInfo: ExtractedInteractionInfo,
  userId: number = 1
): Promise<string> {
  try {
    // Get custom prompt from database if available
    const { storage } = await import('../storage');
    const customPrompt = await storage.getAiPromptSettings(userId.toString(), 'synopsis');
    
    const defaultPrompt = `
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

    // Use custom prompt if available, otherwise use default
    const synopsisPrompt = customPrompt?.promptTemplate
      ? customPrompt.promptTemplate
          .replace('{{transcript}}', transcript)
          .replace('{{summary}}', extractedInfo.summary)
          .replace('{{category}}', extractedInfo.category)
          .replace('{{professionalInterests}}', extractedInfo.professionalInterests.join(', '))
          .replace('{{personalInterests}}', extractedInfo.personalInterests.join(', '))
          .replace('{{philanthropicPriorities}}', extractedInfo.philanthropicPriorities.join(', '))
          .replace('{{keyPoints}}', extractedInfo.keyPoints.join(', '))
      : defaultPrompt;

    const response = await openai.chat.completions.create({
      model: "gpt-5", // the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
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

    const synopsis = response.choices[0].message.content?.trim() || "Analysis not available";
    
    // HEROKU TRANSCRIPT FIX: Include transcript in synopsis for enhanced comments
    const fullSynopsisWithTranscript = `${synopsis}

TRANSCRIPT:
${transcript}`;
    
    console.log("🔧 SYNOPSIS WITH TRANSCRIPT: Generated full synopsis with transcript included");
    console.log("🔧 SYNOPSIS WITH TRANSCRIPT: Full length:", fullSynopsisWithTranscript.length);
    console.log("🔧 SYNOPSIS WITH TRANSCRIPT: Includes TRANSCRIPT section:", fullSynopsisWithTranscript.includes("TRANSCRIPT:"));
    
    return fullSynopsisWithTranscript;
  } catch (error) {
    console.error("Synopsis generation error:", error);
    // Fallback format that includes transcript
    return `Synopsis could not be generated due to processing error.

TRANSCRIPT:
${transcript}`;
  }
}

export async function enhanceInteractionComments(
  transcript: string, 
  extractedInfo: ExtractedInteractionInfo,
  userId: number = 1
): Promise<string> {
  try {
    console.log("🔧 ENHANCE COMMENTS: Starting with transcript length:", transcript?.length || 0);
    
    // Generate comprehensive synopsis
    const synopsis = await generateInteractionSynopsis(transcript, extractedInfo, userId);
    
    console.log("🔧 ENHANCE COMMENTS: Synopsis generated, length:", synopsis?.length || 0);
    
    // Check if synopsis already includes transcript to avoid duplication
    const synopsisIncludesTranscript = synopsis.includes("TRANSCRIPT:");
    
    // Format the final comments - add prefix only if synopsis doesn't already include it
    const formattedComments = synopsisIncludesTranscript 
      ? synopsis  // Synopsis already formatted with ADVANCEMENT OFFICE SYNOPSIS prefix and transcript
      : `ADVANCEMENT OFFICE SYNOPSIS:
${synopsis}

TRANSCRIPT:
${transcript}`;

    console.log("🔧 ENHANCE COMMENTS: Synopsis includes transcript:", synopsisIncludesTranscript);
    console.log("🔧 ENHANCE COMMENTS: Final formatted length:", formattedComments?.length || 0);
    console.log("🔧 ENHANCE COMMENTS: Includes transcript:", formattedComments.includes("TRANSCRIPT:"));
    console.log("🔧 ENHANCE COMMENTS: Input transcript preview:", transcript?.substring(0, 100));
    console.log("🔧 ENHANCE COMMENTS: Final 200 chars:", formattedComments.substring(formattedComments.length - 200));

    return formattedComments;
  } catch (error) {
    console.error("Comment enhancement error:", error);
    console.log("🔧 ENHANCE COMMENTS: Using fallback format with transcript");
    
    // Fallback format if AI processing fails (already includes transcript)
    const fallbackComments = `ADVANCEMENT OFFICE SYNOPSIS:
Synopsis could not be generated due to processing error.

TRANSCRIPT:
${transcript}`;
    
    console.log("🔧 ENHANCE COMMENTS: Fallback includes transcript:", fallbackComments.includes("TRANSCRIPT:"));
    return fallbackComments;
  }
}

export async function evaluateInteractionQuality(
  transcript: string,
  extractedInfo: ExtractedInteractionInfo,
  interactionData: {
    prospectName?: string;
    firstName?: string;
    lastName?: string;
    contactLevel?: string;
    method?: string;
    actualDate?: string;
    comments?: string;
    summary?: string;
    category?: string;
    subcategory?: string;
  }
): Promise<InteractionQualityAssessment> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5", // the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
      messages: [
        {
          role: "system",
          content: `You are an expert fundraising professional who evaluates the quality of donor interaction reports. 

Your task is to assess the quality of a fundraising interaction based on the following 5-point rubric (each category worth 5 points, total 25):

1) Completeness of Information (0-5 points):
- Full contact details present
- Date and time of interaction documented
- Method of communication specified
- Comprehensive meeting/conversation notes

2) Quality of Relationship Insights (0-5 points):
- Captures donor's motivations clearly
- Notes emotional/personal context
- Identifies potential connection points
- Highlights donor's philanthropic interests

3) Strategic Assessment (0-5 points):
- Clear analysis of donor's capacity
- Potential giving level assessment
- Likelihood of future engagement noted
- Recommended next steps provided

4) Communication Effectiveness (0-5 points):
- Professional tone maintained
- Clear, concise language used
- Objective observations recorded
- Grammatical accuracy demonstrated

5) Follow-up Potential (0-5 points):
- Specific action items identified
- Timeline for next contact established
- Potential cultivation strategies outlined
- Alignment with organizational goals noted

Bonus Points (0-5 points):
- Unique insights captured
- Potential major gift indicators identified
- Personal connection details recorded

Scoring Scale:
0-10: Needs significant improvement
11-15: Developing
16-20: Proficient
21-25: Excellent

Provide your assessment in JSON format with detailed explanations for each category score and specific actionable recommendations for improvement.

IMPORTANT: Always include at least 3 specific, actionable recommendations in the "recommendations" array to help the fundraiser improve their interaction quality. These should be practical suggestions they can implement immediately.`
        },
        {
          role: "user",
          content: `Please evaluate the quality of this fundraising interaction:

TRANSCRIPT:
${transcript}

EXTRACTED INFORMATION:
- Prospect Name: ${extractedInfo.prospectName || 'Not specified'}
- Summary: ${extractedInfo.summary}
- Category: ${extractedInfo.category}
- Subcategory: ${extractedInfo.subcategory}
- Professional Interests: ${extractedInfo.professionalInterests.join(', ') || 'None identified'}
- Personal Interests: ${extractedInfo.personalInterests.join(', ') || 'None identified'}
- Philanthropic Priorities: ${extractedInfo.philanthropicPriorities.join(', ') || 'None identified'}
- Key Points: ${extractedInfo.keyPoints.join(', ') || 'None identified'}

INTERACTION DATA:
- Prospect Name: ${interactionData.prospectName || 'Not specified'}
- First Name: ${interactionData.firstName || 'Not specified'}
- Last Name: ${interactionData.lastName || 'Not specified'}
- Contact Level: ${interactionData.contactLevel || 'Not specified'}
- Method: ${interactionData.method || 'Not specified'}
- Date: ${interactionData.actualDate || 'Not specified'}
- Comments: ${interactionData.comments || 'Not specified'}
- Summary: ${interactionData.summary || 'Not specified'}
- Category: ${interactionData.category || 'Not specified'}
- Subcategory: ${interactionData.subcategory || 'Not specified'}

Provide your evaluation in JSON format with this structure:
{
  "qualityScore": <total score 0-25>,
  "categoryScores": {
    "completeness": <score 0-5>,
    "relationshipInsights": <score 0-5>,
    "strategicAssessment": <score 0-5>,
    "communicationEffectiveness": <score 0-5>,
    "followupPotential": <score 0-5>,
    "bonusPoints": <score 0-5>
  },
  "qualityExplanation": "<detailed explanation covering each category with specific examples>",
  "recommendations": [
    "<specific actionable recommendation 1>",
    "<specific actionable recommendation 2>",
    "<specific actionable recommendation 3>"
  ]
}`
        }
      ],
      temperature: 0.3,
      max_tokens: 2000,
      response_format: { type: "json_object" }
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');
    
    // Validate and ensure all required fields are present
    return {
      qualityScore: Math.max(0, Math.min(25, result.qualityScore || 0)),
      qualityExplanation: result.qualityExplanation || 'No explanation provided',
      categoryScores: {
        completeness: Math.max(0, Math.min(5, result.categoryScores?.completeness || 0)),
        relationshipInsights: Math.max(0, Math.min(5, result.categoryScores?.relationshipInsights || 0)),
        strategicAssessment: Math.max(0, Math.min(5, result.categoryScores?.strategicAssessment || 0)),
        communicationEffectiveness: Math.max(0, Math.min(5, result.categoryScores?.communicationEffectiveness || 0)),
        followupPotential: Math.max(0, Math.min(5, result.categoryScores?.followupPotential || 0)),
        bonusPoints: Math.max(0, Math.min(5, result.categoryScores?.bonusPoints || 0))
      },
      recommendations: Array.isArray(result.recommendations) ? result.recommendations : []
    };
  } catch (error) {
    console.error('Error evaluating interaction quality:', error);
    throw new Error('Failed to evaluate interaction quality: ' + (error as Error).message);
  }
}
