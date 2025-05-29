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
      ...professionalInterests,
      ...personalInterests,
      ...philanthropicPriorities
    ];

    const matches: MatchedAffinityTag[] = [];
    const seenTags = new Set<number>();

    for (const interest of allInterests) {
      const searchResults = this.fuse.search(interest);
      
      for (const result of searchResults.slice(0, 2)) { // Top 2 matches per interest
        const tag = result.item;
        const score = 1 - (result.score || 0); // Convert to similarity score
        
        if (!seenTags.has(tag.id) && score > 0.6) { // Minimum similarity threshold
          matches.push({
            tag,
            score,
            matchedInterest: interest
          });
          seenTags.add(tag.id);
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
        
        if (!seenTags.has(tag.id) && score > 0.7) {
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
