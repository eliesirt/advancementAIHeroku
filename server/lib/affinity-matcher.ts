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
    philanthropicPriorities: string[],
    rawTranscript?: string
  ): MatchedAffinityTag[] {
    console.log("🔧 Affinity matcher input:", {
      professional: professionalInterests,
      personal: personalInterests,
      philanthropic: philanthropicPriorities,
      hasRawTranscript: !!rawTranscript,
      transcriptSample: rawTranscript?.substring(0, 50),
      threshold: this.matchingThreshold
    });

    const allInterests = [
      ...(Array.isArray(professionalInterests) ? professionalInterests : []),
      ...(Array.isArray(personalInterests) ? personalInterests : []),
      ...(Array.isArray(philanthropicPriorities) ? philanthropicPriorities : [])
    ];

    console.log("Initial interests array:", allInterests);

    // If rawTranscript is provided, use it for additional direct matching
    if (rawTranscript && rawTranscript.trim().length > 0) {
      console.log("Processing raw transcript for direct matches...");
      // Extract potential interests from raw transcript text
      const transcriptWords = rawTranscript.toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 2);
      
      console.log("Transcript words:", transcriptWords.slice(0, 10));
      
      // Look for direct matches with affinity tag names in the transcript
      let directMatches = 0;
      for (const tag of this.affinityTags) {
        const tagWords = tag.name.toLowerCase().split(/\s+/);
        const hasAllWords = tagWords.every(tagWord => 
          transcriptWords.some(transcriptWord => 
            transcriptWord.includes(tagWord) || tagWord.includes(transcriptWord)
          )
        );
        
        if (hasAllWords && tagWords.length > 0) {
          allInterests.push(tag.name); // Add direct transcript matches as interests
          directMatches++;
          if (directMatches < 5) { // Limit logging
            console.log("Direct transcript match found:", tag.name);
          }
        }
      }
      console.log(`Found ${directMatches} direct transcript matches`);
    }

    console.log("Final interests to match:", allInterests);

    const matches: MatchedAffinityTag[] = [];
    const seenTags = new Set<number>();

    console.log("Starting fuzzy matching process...");
    for (const interest of allInterests) {
      console.log(`Matching interest: "${interest}"`);
      // Get variations of the interest for better matching
      const variations = this.preprocessInterest(interest);
      console.log(`Interest variations: [${variations.join(', ')}]`);
      
      for (const variation of variations) {
        const searchResults = this.fuse.search(variation);
        console.log(`Search results for "${variation}":`, searchResults.length);
        
        for (const result of searchResults.slice(0, 3)) { // Top 3 matches per variation
          const tag = result.item;
          const score = 1 - (result.score || 0); // Convert to similarity score
          
          console.log(`Candidate match: "${tag.name}" (score: ${score.toFixed(3)}, threshold: ${this.matchingThreshold})`);
          
          if (!seenTags.has(tag.id) && score > this.matchingThreshold) { // Configurable threshold
            matches.push({
              tag,
              score,
              matchedInterest: interest
            });
            seenTags.add(tag.id);
            console.log(`✅ Added match: "${tag.name}" (score: ${score.toFixed(3)})`);
          } else if (seenTags.has(tag.id)) {
            console.log(`❌ Already seen: "${tag.name}"`);
          } else {
            console.log(`❌ Score too low: "${tag.name}" (${score.toFixed(3)} <= ${this.matchingThreshold})`);
          }
        }
      }
    }

    console.log(`Final match results: ${matches.length} tags matched`);

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
