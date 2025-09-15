import OpenAI from "openai";
import type { ProspectSummaryData } from "@shared/schema";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function generateProspectSummary(summaryData: ProspectSummaryData, userId: string): Promise<string> {
  try {
    // Get custom prompt from user settings
    const { storage } = await import('../storage');
    const customPrompt = await storage.getUserSettingValue(
      userId,
      'portfolio.generateAiPrompt',
      `You are an expert fundraising analyst. Analyze this prospect's profile and generate a comprehensive AI summary including:

1. **Prospect Overview**: Key demographic and professional information
2. **Giving Capacity**: Analysis of their potential giving level based on available data
3. **Engagement History**: Summary of past interactions and giving patterns
4. **Strategic Insights**: Key opportunities and considerations for cultivation
5. **Relationship Mapping**: Important connections and affiliations

Focus on actionable insights that will help the fundraiser build meaningful relationships and identify cultivation opportunities.`
    );

    // Build the data context for the custom prompt
    const locationInfo = summaryData.location && (summaryData.location.city || summaryData.location.state || summaryData.location.country) 
      ? `${summaryData.location.city || ''}${summaryData.location.city && summaryData.location.state ? ', ' : ''}${summaryData.location.state || ''}${(summaryData.location.city || summaryData.location.state) && summaryData.location.country ? ', ' : ''}${summaryData.location.country || ''}`.trim()
      : 'Not specified';
    
    const prospectDataContext = `
PROSPECT DATA:
- Interaction History: ${summaryData.interactionHistory.totalCount} total interactions, last contact ${summaryData.interactionHistory.lastContactDate ? new Date(summaryData.interactionHistory.lastContactDate).toDateString() : 'Unknown'}
- Donor History: $${summaryData.donorHistory.lifetimeGiving.toLocaleString()} lifetime giving, $${summaryData.donorHistory.currentYearGiving.toLocaleString()} this year
- Event Attendance: ${summaryData.eventAttendance.totalEvents} events attended, favorite types: ${summaryData.eventAttendance.favoriteEventTypes.join(', ')}
- Professional: ${summaryData.professional.currentPosition || 'Not specified'} at ${summaryData.professional.employer || 'Not specified'}
- Location: ${locationInfo}
- Engagement Level: ${summaryData.engagement.prospectRating} prospect, ${summaryData.engagement.inclination} inclination, ${summaryData.engagement.stage} stage
- Relationships: ${summaryData.relationships.spouse ? `Spouse: ${summaryData.relationships.spouse}` : 'No spouse data'}`;

    // Combine custom prompt with prospect data
    const fullPrompt = `${customPrompt}\n\n${prospectDataContext}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o", // Using GPT-4o for stable API compatibility
      messages: [{ role: "user", content: fullPrompt }],
      max_tokens: 800,
      temperature: 0.7,
    });

    return response.choices[0].message.content || "Unable to generate summary at this time.";
  } catch (error) {
    console.error("Error generating prospect summary:", error);
    return "Error generating prospect summary. Please try again.";
  }
}

export async function generateNextActions(summaryData: ProspectSummaryData, prospectName: string, userId: string): Promise<string> {
  try {
    // Get custom prompt from user settings
    const { storage } = await import('../storage');
    const customPrompt = await storage.getUserSettingValue(
      userId,
      'portfolio.nextActionsPrompt',
      `You are a strategic fundraising advisor. Based on this prospect's profile and interaction history, recommend 3-5 specific next actions for the fundraiser:

1. **Immediate Actions** (next 1-2 weeks)
2. **Short-term Strategy** (next 1-3 months)  
3. **Long-term Cultivation** (3-12 months)

Each recommendation should be:
- Specific and actionable
- Tailored to the prospect's interests and giving capacity
- Focused on relationship building and stewardship
- Include suggested timeline and follow-up steps

Consider their preferred communication methods, past giving history, and current engagement level.`
    );

    // Build the data context for the custom prompt
    const locationInfo = summaryData.location && (summaryData.location.city || summaryData.location.state || summaryData.location.country) 
      ? `${summaryData.location.city || ''}${summaryData.location.city && summaryData.location.state ? ', ' : ''}${summaryData.location.state || ''}${(summaryData.location.city || summaryData.location.state) && summaryData.location.country ? ', ' : ''}${summaryData.location.country || ''}`.trim()
      : 'Not specified';
    
    const prospectDataContext = `
PROSPECT DATA:
Prospect: ${prospectName}
Current Stage: ${summaryData.engagement.stage}
Last Contact: ${summaryData.interactionHistory.lastContactDate ? new Date(summaryData.interactionHistory.lastContactDate).toDateString() : 'Unknown'}
Giving Capacity: $${summaryData.engagement.capacity?.toLocaleString() || 'Not specified'}
Inclination: ${summaryData.engagement.inclination}
Location: ${locationInfo}
Recent Event Attendance: ${summaryData.eventAttendance.lastTwoYears.slice(0, 3).map(e => e.eventName).join(', ')}
Professional Background: ${summaryData.professional.currentPosition} at ${summaryData.professional.employer}

Recent Interaction Patterns:
- Average contacts per month: ${summaryData.interactionHistory.averageContactsPerMonth}
- Attendance rate: ${summaryData.eventAttendance.attendanceRate}%
- Engagement trend: ${summaryData.engagement.engagementTrend}`;

    // Combine custom prompt with prospect data
    const fullPrompt = `${customPrompt}\n\n${prospectDataContext}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o", // Using GPT-4o for stable API compatibility
      messages: [{ role: "user", content: fullPrompt }],
      max_tokens: 600,
      temperature: 0.8,
    });

    return response.choices[0].message.content || "Unable to generate next actions at this time.";
  } catch (error) {
    console.error("Error generating next actions:", error);
    return "Error generating next actions. Please try again.";
  }
}

export async function generateProspectBadges(summaryData: ProspectSummaryData): Promise<Array<{
  badgeType: string;
  badgeName: string;
  badgeDescription: string;
  badgeIcon: string;
  badgeColor: string;
}>> {
  const badges = [];

  // Donor milestone badges
  if (summaryData.donorHistory.lifetimeGiving >= 1000000) {
    badges.push({
      badgeType: 'donor_milestone',
      badgeName: 'Million Dollar Donor',
      badgeDescription: 'Lifetime giving exceeds $1 million',
      badgeIcon: '💎',
      badgeColor: 'purple'
    });
  } else if (summaryData.donorHistory.lifetimeGiving >= 100000) {
    badges.push({
      badgeType: 'donor_milestone',
      badgeName: 'Major Donor',
      badgeDescription: 'Lifetime giving exceeds $100,000',
      badgeIcon: '🏆',
      badgeColor: 'gold'
    });
  } else if (summaryData.donorHistory.lifetimeGiving >= 10000) {
    badges.push({
      badgeType: 'donor_milestone',
      badgeName: 'Significant Donor',
      badgeDescription: 'Lifetime giving exceeds $10,000',
      badgeIcon: '⭐',
      badgeColor: 'blue'
    });
  }

  // Event attendance badges
  if (summaryData.eventAttendance.attendanceRate >= 80) {
    badges.push({
      badgeType: 'event_attendance',
      badgeName: 'Event Enthusiast',
      badgeDescription: 'Attends 80%+ of invited events',
      badgeIcon: '🎉',
      badgeColor: 'green'
    });
  }

  // Engagement badges
  if (summaryData.interactionHistory.averageContactsPerMonth >= 2) {
    badges.push({
      badgeType: 'engagement',
      badgeName: 'Highly Engaged',
      badgeDescription: 'Frequent communication and interaction',
      badgeIcon: '🤝',
      badgeColor: 'orange'
    });
  }

  // Professional badges
  if (summaryData.professional.currentPosition?.toLowerCase().includes('ceo') || 
      summaryData.professional.currentPosition?.toLowerCase().includes('president')) {
    badges.push({
      badgeType: 'professional',
      badgeName: 'Executive Leader',
      badgeDescription: 'C-suite or senior executive position',
      badgeIcon: '👔',
      badgeColor: 'navy'
    });
  }

  return badges;
}

export async function generateProspectResearch(summaryData: ProspectSummaryData, prospectName: string, userId: string): Promise<string> {
  try {
    // Get custom prompt from user settings
    const { storage } = await import('../storage');
    const customPrompt = await storage.getUserSettingValue(
      userId,
      'portfolio.prospectResearchPrompt',
      `You are a prospect research specialist with expertise in identifying wealth indicators and philanthropic patterns. Based on the prospect's information including their location, analyze and research potential indicators of:

1. **Wealth Indicators**: Look for professional achievements, business affiliations, executive positions, board memberships, or property ownership that might indicate giving capacity
2. **Philanthropic History**: Research giving patterns to educational institutions, health organizations, arts/culture, or community foundations  
3. **Current News & Activities**: Recent professional accomplishments, company news, awards, or public recognition
4. **Strategic Connections**: University affiliations, alumni networks, professional associations, or social connections relevant to Boston University
5. **Location-Based Insights**: Consider regional giving patterns, local community involvement, or geographic ties to Boston/Massachusetts

Please provide actionable intelligence that could help a gift officer:
- Identify optimal cultivation strategies
- Find common ground for relationship building  
- Understand their philanthropic interests and motivations
- Determine appropriate ask levels and timing
- Locate mutual connections or introduction opportunities

Focus on publicly available information and avoid speculation. Provide specific, actionable insights with suggested next steps.`
    );

    // Build the data context for the custom prompt
    const locationInfo = summaryData.location && (summaryData.location.city || summaryData.location.state || summaryData.location.country) 
      ? `${summaryData.location.city || ''}${summaryData.location.city && summaryData.location.state ? ', ' : ''}${summaryData.location.state || ''}${(summaryData.location.city || summaryData.location.state) && summaryData.location.country ? ', ' : ''}${summaryData.location.country || ''}`.trim()
      : 'Not specified';
    
    const prospectDataContext = `
PROSPECT RESEARCH TARGET:
Prospect: ${prospectName}
Location: ${locationInfo}
Professional Background: ${summaryData.professional.currentPosition || 'Not specified'} at ${summaryData.professional.employer || 'Not specified'}
Current Prospect Rating: ${summaryData.engagement.prospectRating}
Giving History: $${summaryData.donorHistory.lifetimeGiving.toLocaleString()} lifetime giving
Current Stage: ${summaryData.engagement.stage}
Event Participation: ${summaryData.eventAttendance.totalEvents} events attended
Engagement Level: ${summaryData.engagement.inclination} inclination
Relationships: ${summaryData.relationships.spouse ? `Spouse: ${summaryData.relationships.spouse}` : 'Single or unknown'}

Research Focus Areas:
- Use the location information to identify regional wealth indicators and local connections
- Look for professional achievements, board memberships, and executive positions
- Identify potential philanthropic interests and giving patterns
- Find Boston University or Massachusetts connections
- Suggest cultivation strategies based on publicly available information`;

    // Combine custom prompt with prospect data
    const fullPrompt = `${customPrompt}\n\n${prospectDataContext}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o", // Using GPT-4o for stable API compatibility
      messages: [{ role: "user", content: fullPrompt }],
      max_tokens: 1000,
      temperature: 0.6,
    });

    return response.choices[0].message.content || "Unable to generate prospect research at this time.";
  } catch (error) {
    console.error("Error generating prospect research:", error);
    return "Error generating prospect research. Please try again.";
  }
}