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

  constructor(affinityTags: AffinityTag[]) {
    this.affinityTags = affinityTags;
    this.fuse = new Fuse(affinityTags, {
      keys: ['name', 'category'],
      threshold: 0.4, // Allow somewhat fuzzy matching
      includeScore: true,
    });
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

    console.log('DEBUG: Matching interests:', allInterests);

    const matches: MatchedAffinityTag[] = [];
    const seenTags = new Set<number>();

    for (const interest of allInterests) {
      const searchResults = this.fuse.search(interest);
      console.log(`DEBUG: Interest "${interest}" found ${searchResults.length} results`);
      
      for (const result of searchResults.slice(0, 3)) { // Top 3 matches per interest
        const tag = result.item;
        const score = 1 - (result.score || 0); // Convert to similarity score
        
        console.log(`DEBUG: Interest "${interest}" -> Tag "${tag.name}" (score: ${score.toFixed(3)})`);
        
        if (!seenTags.has(tag.id) && score > 0.6) { // Minimum similarity threshold - increased for accuracy
          console.log(`DEBUG: MATCH ACCEPTED: "${interest}" -> "${tag.name}" (score: ${score.toFixed(3)})`);
          matches.push({
            tag,
            score,
            matchedInterest: interest
          });
          seenTags.add(tag.id);
        } else if (score <= 0.4) {
          console.log(`DEBUG: MATCH REJECTED: Score too low (${score.toFixed(3)} <= 0.4)`);
        }
      }
    }

    // Sort by score (highest first) and limit to top 10
    const sortedMatches = matches
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
    
    console.log('DEBUG: Final matched tags:', sortedMatches.map(m => `${m.tag.name} (${m.score.toFixed(3)})`));
    
    return sortedMatches;
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
export async function createAffinityMatcher(affinityTags: AffinityTag[]): Promise<AffinityMatcher> {
  return new AffinityMatcher(affinityTags);
}
