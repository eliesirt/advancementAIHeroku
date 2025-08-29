import Fuse from 'fuse.js';
import type { AffinityTag } from '@shared/schema';

export interface MatchedAffinityTag {
  tag: AffinityTag;
  score: number;
  matchedInterest: string;
}

export class AffinityMatcher {
  private fuse: Fuse<AffinityTag>;
  private affinityTags: AffinityTag[];
  private matchingThreshold: number;

  constructor(affinityTags: AffinityTag[], matchingThreshold: number = 0.25) {
    console.log("🏗️ AFFINITY MATCHER CONSTRUCTOR:", {
      tagsCount: affinityTags.length,
      threshold: matchingThreshold,
      sampleTags: affinityTags.slice(0, 3).map(t => t.name)
    });
    
    this.affinityTags = affinityTags;
    // Convert percentage (0-100) to decimal (0-1) if needed
    this.matchingThreshold = matchingThreshold > 1 ? matchingThreshold / 100 : matchingThreshold;
    
    console.log("🔧 THRESHOLD CONVERSION:", {
      original: matchingThreshold,
      converted: this.matchingThreshold,
      wasPercentage: matchingThreshold > 1
    });
    this.fuse = new Fuse(affinityTags, {
      keys: ['name', 'category'],
      threshold: 0.50, // Midrange threshold for better matching
      includeScore: true,
    });
  }

  // Preprocess interest strings to improve matching
  private preprocessInterest(interest: string): string[] {
    const variations = [interest]; // Always include original
    
    // Remove common prefixes and suffixesOpen
    const cleaned = interest
      .replace(/^(Friends of |Support for |Supporting |Funding for |Donation to |Gift to )/i, '')
      .replace(/\s+(program|initiative|fund|foundation|department|college|school)$/i, '')
      .replace(/\s+at\s+\w+/i, '') // Remove "at Boston University" type phrases
      .replace(/\s+BU\s+/i, ' ') // Remove "BU" abbreviation
      .replace(/\s+Boston University\s+/i, ' ') // Remove "Boston University"
      .trim();
    
    if (cleaned !== interest) {
      variations.push(cleaned);
    }
    
    // Add specific variations for better matching
    if (interest.toLowerCase().includes('ice hockey')) {
      variations.push('Men\'s Hockey', 'Women\'s Hockey', 'Hockey');
    }
    
    // Engineering variations
    if (interest.toLowerCase().includes('engineering')) {
      variations.push('College of Engineering', 'School of Engineering', 'Engineering Department');
    }
    
    // Education variations  
    if (interest.toLowerCase().includes('education')) {
      variations.push('Education Department', 'School of Education', 'Educational Programs');
    }
    
    return variations;
  }

  matchInterests(
    professionalInterests: string[],
    personalInterests: string[],
    philanthropicPriorities: string[],
    rawTranscript?: string
  ): MatchedAffinityTag[] {
    console.log("🔍 AFFINITY MATCHER DEBUG: Starting match with:", {
      professionalCount: professionalInterests.length,
      personalCount: personalInterests.length,
      philanthropicCount: philanthropicPriorities.length,
      rawTranscriptLength: rawTranscript?.length || 0,
      totalAffinityTags: this.affinityTags.length,
      threshold: this.matchingThreshold
    });

    console.log("🔍 INTERESTS DEBUG:", {
      professional: professionalInterests,
      personal: personalInterests,
      philanthropic: philanthropicPriorities,
      rawTranscript: rawTranscript?.substring(0, 50) + '...'
    });

    const allInterests = [
      ...(Array.isArray(professionalInterests) ? professionalInterests : []),
      ...(Array.isArray(personalInterests) ? personalInterests : []),
      ...(Array.isArray(philanthropicPriorities) ? philanthropicPriorities : [])
    ];

    console.log("🔍 ALL INTERESTS:", allInterests);

    // If rawTranscript is provided, use it for additional direct matching
    if (rawTranscript && rawTranscript.trim().length > 0) {
      // Extract potential interests from raw transcript text
      const transcriptWords = rawTranscript.toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 2);
      
      // Look for direct matches with affinity tag names in the transcript
      for (const tag of this.affinityTags) {
        const tagWords = tag.name.toLowerCase().split(/\s+/);
        const hasAllWords = tagWords.every(tagWord => 
          transcriptWords.some(transcriptWord => 
            transcriptWord.includes(tagWord) || tagWord.includes(transcriptWord)
          )
        );
        
        if (hasAllWords && tagWords.length > 0) {
          allInterests.push(tag.name); // Add direct transcript matches as interests
        }
      }
    }

    const matches: MatchedAffinityTag[] = [];
    const seenTags = new Set<number>();

    for (const interest of allInterests) {
      // Get variations of the interest for better matching
      const variations = this.preprocessInterest(interest);
      
      for (const variation of variations) {
        const searchResults = this.fuse.search(variation);
        
        console.log("🔍 SEARCH RESULTS for '" + variation + "':", {
          resultsCount: searchResults.length,
          topResults: searchResults.slice(0, 3).map(r => ({
            name: r.item.name,
            score: r.score?.toFixed(3)
          }))
        });
        
        for (const result of searchResults.slice(0, 3)) { // Top 3 matches per variation
          const tag = result.item;
          const score = 1 - (result.score || 0); // Convert to similarity score
          
          console.log("🔍 SCORE CHECK:", {
            tagName: tag.name,
            score: score.toFixed(3),
            threshold: this.matchingThreshold.toFixed(3),
            passes: score > this.matchingThreshold
          });
          
          if (!seenTags.has(tag.id) && score > this.matchingThreshold) { // Configurable threshold
            matches.push({
              tag,
              score,
              matchedInterest: interest
            });
            seenTags.add(tag.id);
          }
        }
      }
    }

    console.log("🔍 FINAL MATCHES:", {
      matchCount: matches.length,
      matches: matches.map(m => ({ tag: m.tag.name, score: m.score, interest: m.matchedInterest }))
    });

    // HEROKU PRODUCTION FALLBACK: If no matches found, use more lenient search
    if (matches.length === 0 && allInterests.length > 0) {
      console.log("🚨 HEROKU FALLBACK: No matches found, trying lenient search");
      
      for (const interest of allInterests) {
        const lowerInterest = interest.toLowerCase();
        
        // Direct substring matching for common cases
        const directMatches = this.affinityTags.filter(tag => {
          const lowerTagName = tag.name.toLowerCase();
          return lowerTagName.includes(lowerInterest) || 
                 lowerInterest.includes(lowerTagName) ||
                 // Engineering specific matches
                 (lowerInterest.includes('engineer') && lowerTagName.includes('engineer')) ||
                 // Education specific matches  
                 (lowerInterest.includes('education') && lowerTagName.includes('education'));
        });
        
        console.log("🚨 DIRECT MATCHES for '" + interest + "':", directMatches.length);
        
        // Add the best direct matches
        for (const tag of directMatches.slice(0, 3)) {
          if (!seenTags.has(tag.id)) {
            matches.push({
              tag,
              score: 0.8, // High fallback score
              matchedInterest: interest
            });
            seenTags.add(tag.id);
            console.log("🚨 ADDED FALLBACK MATCH:", tag.name);
          }
        }
      }
    }

    console.log("🔍 FINAL MATCHES (after fallback):", {
      matchCount: matches.length,
      matches: matches.map(m => ({ tag: m.tag.name, score: m.score, interest: m.matchedInterest }))
    });

    // Sort by score (highest first) and limit to top 10
    return matches
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
  }

  findSimilarTags(searchTerm: string, limit: number = 5): AffinityTag[] {
    const results = this.fuse.search(searchTerm);
    return results.slice(0, limit).map(result => result.item);
  }

  // Enhanced matching using semantic similarity for specific domains
  matchByCategory(interests: string[], category: 'Professional' | 'Personal' | 'Philanthropic'): MatchedAffinityTag[] {
    const categoryTags = this.affinityTags.filter(tag => 
      tag.category.toLowerCase() === category.toLowerCase()
    );

    const categoryFuse = new Fuse(categoryTags, {
      keys: ['name'],
      threshold: 0.3,
      includeScore: true,
    });

    const matches: MatchedAffinityTag[] = [];
    const seenTags = new Set<number>();

    for (const interest of interests) {
      const results = categoryFuse.search(interest);
      
      for (const result of results.slice(0, 3)) {
        const tag = result.item;
        const score = 1 - (result.score || 0);
        
        if (!seenTags.has(tag.id) && score > 0.5) {
          matches.push({
            tag,
            score,
            matchedInterest: interest
          });
          seenTags.add(tag.id);
        }
      }
    }

    return matches.sort((a, b) => b.score - a.score);
  }
}

// Utility function to create matcher with fresh data
export async function createAffinityMatcher(affinityTags: AffinityTag[], matchingThreshold?: number): Promise<AffinityMatcher> {
  return new AffinityMatcher(affinityTags, matchingThreshold);
}
