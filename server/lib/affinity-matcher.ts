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
    this.affinityTags = affinityTags;
    this.matchingThreshold = matchingThreshold;
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
    
    // Add specific sport variations
    if (interest.toLowerCase().includes('ice hockey')) {
      variations.push('Men\'s Hockey', 'Women\'s Hockey', 'Hockey');
    }
    
    return variations;
  }

  matchInterests(
    professionalInterests: string[],
    personalInterests: string[],
    philanthropicPriorities: string[]
  ): MatchedAffinityTag[] {
    const allInterests = [
      ...(Array.isArray(professionalInterests) ? professionalInterests : []),
      ...(Array.isArray(personalInterests) ? personalInterests : []),
      ...(Array.isArray(philanthropicPriorities) ? philanthropicPriorities : [])
    ];

    const matches: MatchedAffinityTag[] = [];
    const seenTags = new Set<number>();

    for (const interest of allInterests) {
      // Get variations of the interest for better matching
      const variations = this.preprocessInterest(interest);
      
      for (const variation of variations) {
        const searchResults = this.fuse.search(variation);
        
        for (const result of searchResults.slice(0, 3)) { // Top 3 matches per variation
          const tag = result.item;
          const score = 1 - (result.score || 0); // Convert to similarity score
          
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
