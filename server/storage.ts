import { 
  users, 
  interactions, 
  affinityTags, 
  voiceRecordings,
  type User, 
  type InsertUser,
  type Interaction,
  type InsertInteraction,
  type AffinityTag,
  type InsertAffinityTag,
  type VoiceRecording,
  type InsertVoiceRecording
} from "@shared/schema";

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Interaction methods
  getInteraction(id: number): Promise<Interaction | undefined>;
  getInteractionsByUser(userId: number): Promise<Interaction[]>;
  getRecentInteractions(userId: number, limit?: number): Promise<Interaction[]>;
  createInteraction(interaction: InsertInteraction): Promise<Interaction>;
  updateInteraction(id: number, updates: Partial<InsertInteraction>): Promise<Interaction>;
  deleteInteraction(id: number): Promise<boolean>;
  getDraftInteractions(userId: number): Promise<Interaction[]>;
  getPendingInteractions(userId: number): Promise<Interaction[]>;

  // Affinity tag methods
  getAffinityTags(): Promise<AffinityTag[]>;
  createAffinityTag(tag: InsertAffinityTag): Promise<AffinityTag>;
  updateAffinityTags(tags: InsertAffinityTag[]): Promise<void>;

  // Voice recording methods
  getVoiceRecording(id: number): Promise<VoiceRecording | undefined>;
  createVoiceRecording(recording: InsertVoiceRecording): Promise<VoiceRecording>;
  updateVoiceRecording(id: number, updates: Partial<InsertVoiceRecording>): Promise<VoiceRecording>;
  getUnprocessedRecordings(userId: number): Promise<VoiceRecording[]>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private interactions: Map<number, Interaction>;
  private affinityTags: Map<number, AffinityTag>;
  private voiceRecordings: Map<number, VoiceRecording>;
  private currentUserId: number;
  private currentInteractionId: number;
  private currentAffinityTagId: number;
  private currentVoiceRecordingId: number;

  constructor() {
    this.users = new Map();
    this.interactions = new Map();
    this.affinityTags = new Map();
    this.voiceRecordings = new Map();
    this.currentUserId = 1;
    this.currentInteractionId = 1;
    this.currentAffinityTagId = 1;
    this.currentVoiceRecordingId = 1;

    // Initialize with default data
    this.initializeDefaultData();
  }

  private initializeDefaultData() {
    // Create default user
    const defaultUser: User = {
      id: 1,
      username: "sarah.thompson",
      password: "hashed_password",
      name: "Sarah Thompson",
      role: "Senior Development Officer",
      createdAt: new Date(),
    };
    this.users.set(1, defaultUser);
    this.currentUserId = 2;

    // Initialize default affinity tags
    const defaultTags: AffinityTag[] = [
      { id: 1, name: "Medical Research", category: "Professional", bbecId: "MED001", lastSynced: new Date() },
      { id: 2, name: "Healthcare Technology", category: "Professional", bbecId: "TECH001", lastSynced: new Date() },
      { id: 3, name: "Education Support", category: "Philanthropic", bbecId: "EDU001", lastSynced: new Date() },
      { id: 4, name: "Arts & Culture", category: "Personal", bbecId: "ART001", lastSynced: new Date() },
      { id: 5, name: "Technology Innovation", category: "Professional", bbecId: "TECH002", lastSynced: new Date() },
      { id: 6, name: "Golf", category: "Personal", bbecId: "GOLF001", lastSynced: new Date() },
      { id: 7, name: "Classical Music", category: "Personal", bbecId: "MUS001", lastSynced: new Date() },
      { id: 8, name: "Environmental Conservation", category: "Philanthropic", bbecId: "ENV001", lastSynced: new Date() },
      { id: 9, name: "Youth Programs", category: "Philanthropic", bbecId: "YOUTH001", lastSynced: new Date() },
      { id: 10, name: "Engineering School", category: "Philanthropic", bbecId: "ENG001", lastSynced: new Date() },
    ];

    defaultTags.forEach(tag => {
      this.affinityTags.set(tag.id, tag);
    });
    this.currentAffinityTagId = 11;
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.username === username);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const user: User = { 
      ...insertUser, 
      id,
      createdAt: new Date()
    };
    this.users.set(id, user);
    return user;
  }

  // Interaction methods
  async getInteraction(id: number): Promise<Interaction | undefined> {
    return this.interactions.get(id);
  }

  async getInteractionsByUser(userId: number): Promise<Interaction[]> {
    return Array.from(this.interactions.values())
      .filter(interaction => interaction.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getRecentInteractions(userId: number, limit: number = 10): Promise<Interaction[]> {
    return Array.from(this.interactions.values())
      .filter(interaction => interaction.userId === userId && !interaction.isDraft)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  async createInteraction(insertInteraction: InsertInteraction): Promise<Interaction> {
    const id = this.currentInteractionId++;
    const now = new Date();
    const interaction: Interaction = { 
      ...insertInteraction,
      id,
      userId: 1, // Default to first user for demo
      createdAt: now,
      updatedAt: now
    };
    this.interactions.set(id, interaction);
    return interaction;
  }

  async updateInteraction(id: number, updates: Partial<InsertInteraction>): Promise<Interaction> {
    const existing = this.interactions.get(id);
    if (!existing) {
      throw new Error(`Interaction with id ${id} not found`);
    }

    const updated: Interaction = {
      ...existing,
      ...updates,
      updatedAt: new Date()
    };
    this.interactions.set(id, updated);
    return updated;
  }

  async deleteInteraction(id: number): Promise<boolean> {
    return this.interactions.delete(id);
  }

  async getDraftInteractions(userId: number): Promise<Interaction[]> {
    return Array.from(this.interactions.values())
      .filter(interaction => interaction.userId === userId && interaction.isDraft)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  async getPendingInteractions(userId: number): Promise<Interaction[]> {
    return Array.from(this.interactions.values())
      .filter(interaction => 
        interaction.userId === userId && 
        !interaction.bbecSubmitted && 
        !interaction.isDraft
      )
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  // Affinity tag methods
  async getAffinityTags(): Promise<AffinityTag[]> {
    return Array.from(this.affinityTags.values())
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async createAffinityTag(insertTag: InsertAffinityTag): Promise<AffinityTag> {
    const id = this.currentAffinityTagId++;
    const tag: AffinityTag = { 
      ...insertTag, 
      id,
      lastSynced: new Date()
    };
    this.affinityTags.set(id, tag);
    return tag;
  }

  async updateAffinityTags(tags: InsertAffinityTag[]): Promise<void> {
    // Clear existing tags and replace with new ones
    this.affinityTags.clear();
    this.currentAffinityTagId = 1;

    for (const insertTag of tags) {
      await this.createAffinityTag(insertTag);
    }
  }

  // Voice recording methods
  async getVoiceRecording(id: number): Promise<VoiceRecording | undefined> {
    return this.voiceRecordings.get(id);
  }

  async createVoiceRecording(insertRecording: InsertVoiceRecording): Promise<VoiceRecording> {
    const id = this.currentVoiceRecordingId++;
    const recording: VoiceRecording = { 
      ...insertRecording,
      id,
      userId: 1, // Default to first user for demo
      createdAt: new Date()
    };
    this.voiceRecordings.set(id, recording);
    return recording;
  }

  async updateVoiceRecording(id: number, updates: Partial<InsertVoiceRecording>): Promise<VoiceRecording> {
    const existing = this.voiceRecordings.get(id);
    if (!existing) {
      throw new Error(`Voice recording with id ${id} not found`);
    }

    const updated: VoiceRecording = {
      ...existing,
      ...updates
    };
    this.voiceRecordings.set(id, updated);
    return updated;
  }

  async getUnprocessedRecordings(userId: number): Promise<VoiceRecording[]> {
    return Array.from(this.voiceRecordings.values())
      .filter(recording => recording.userId === userId && !recording.processed)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
}

export const storage = new MemStorage();
