import OpenAI from "openai";
import type { ProspectSummaryData } from "@shared/schema";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function generateProspectSummary(summaryData: ProspectSummaryData): Promise<string> {
  try {
    const prompt = `As an expert fundraising AI assistant, generate a comprehensive prospect summary based on the following data. The summary should be professional, actionable, and highlight key opportunities for engagement.

Prospect Data:
- Interaction History: ${summaryData.interactionHistory.totalCount} total interactions, last contact ${summaryData.interactionHistory.lastContactDate ? new Date(summaryData.interactionHistory.lastContactDate).toDateString() : 'Unknown'}
- Donor History: $${summaryData.donorHistory.lifetimeGiving.toLocaleString()} lifetime giving, $${summaryData.donorHistory.currentYearGiving.toLocaleString()} this year
- Event Attendance: ${summaryData.eventAttendance.totalEvents} events attended, favorite types: ${summaryData.eventAttendance.favoriteEventTypes.join(', ')}
- Professional: ${summaryData.professional.currentPosition || 'Not specified'} at ${summaryData.professional.employer || 'Not specified'}
- Engagement Level: ${summaryData.engagement.prospectRating} prospect, ${summaryData.engagement.inclination} inclination, ${summaryData.engagement.stage} stage
- Relationships: ${summaryData.relationships.spouse ? `Spouse: ${summaryData.relationships.spouse}` : 'No spouse data'}

Please provide a concise but comprehensive summary (3-4 paragraphs) that includes:
1. Key relationship highlights and engagement history
2. Giving patterns and financial capacity insights
3. Personal interests and professional background
4. Family and relationship connections

Focus on actionable insights that would help a fundraiser build stronger relationships.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [{ role: "user", content: prompt }],
      max_tokens: 800,
      temperature: 0.7,
    });

    return response.choices[0].message.content || "Unable to generate summary at this time.";
  } catch (error) {
    console.error("Error generating prospect summary:", error);
    return "Error generating prospect summary. Please try again.";
  }
}

export async function generateNextActions(summaryData: ProspectSummaryData, prospectName: string): Promise<string> {
  try {
    const prompt = `As an expert fundraising strategist, recommend specific next actions for engaging with this prospect based on their profile data.

Prospect: ${prospectName}
Current Stage: ${summaryData.engagement.stage}
Last Contact: ${summaryData.interactionHistory.lastContactDate ? new Date(summaryData.interactionHistory.lastContactDate).toDateString() : 'Unknown'}
Giving Capacity: $${summaryData.engagement.capacity?.toLocaleString() || 'Not specified'}
Inclination: ${summaryData.engagement.inclination}
Recent Event Attendance: ${summaryData.eventAttendance.lastTwoYears.slice(0, 3).map(e => e.eventName).join(', ')}
Professional Background: ${summaryData.professional.currentPosition} at ${summaryData.professional.employer}

Recent Interaction Patterns:
- Average contacts per month: ${summaryData.interactionHistory.averageContactsPerMonth}
- Attendance rate: ${summaryData.eventAttendance.attendanceRate}%
- Engagement trend: ${summaryData.engagement.engagementTrend}

Please provide 4-5 specific, actionable next steps prioritized by importance. Each action should include:
- The specific action to take
- The recommended timing
- The expected outcome
- Any special considerations

Format as a bulleted list with clear, actionable items.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [{ role: "user", content: prompt }],
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