import {
  users,
  interactions,
  affinityTags,
  voiceRecordings,
  affinityTagSettings,
  type User,
  type InsertUser,
  type Interaction,
  type InsertInteraction,
  type AffinityTag,
  type InsertAffinityTag,
  type VoiceRecording,
  type InsertVoiceRecording,
  type AffinityTagSettings,
  type InsertAffinityTagSettings
} from "@shared/schema";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, updates: Partial<InsertUser>): Promise<User>;

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
  clearAffinityTags(): Promise<void>;

  // Affinity tag settings methods
  getAffinityTagSettings(): Promise<AffinityTagSettings | undefined>;
  updateAffinityTagSettings(settings: InsertAffinityTagSettings): Promise<void>;

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
      firstName: null,
      lastName: null,
      email: null,
      buid: null,
      bbecGuid: null,
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
      createdAt: new Date(),
      firstName: insertUser.firstName || null,
      lastName: insertUser.lastName || null,
      email: insertUser.email || null,
      buid: insertUser.buid || null,
      bbecGuid: insertUser.bbecGuid || null
    };
    this.users.set(id, user);
    return user;
  }

  async updateUser(id: number, updates: Partial<InsertUser>): Promise<User> {
    const existingUser = this.users.get(id);
    if (!existingUser) {
      throw new Error(`User with id ${id} not found`);
    }

    const updatedUser: User = {
      ...existingUser,
      ...updates
    };

    this.users.set(id, updatedUser);
    return updatedUser;
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
      userId: 1, // Default user ID
      createdAt: now,
      updatedAt: now,
      status: insertInteraction.status || "draft",
      transcript: insertInteraction.transcript || null,
      owner: insertInteraction.owner || null,
      firstName: insertInteraction.firstName || null,
      lastName: insertInteraction.lastName || null,
      buid: insertInteraction.buid || null,
      bbecGuid: insertInteraction.bbecGuid || null,
      constituentGuid: insertInteraction.constituentGuid || null,
      comments: insertInteraction.comments || null,
      affinityTags: insertInteraction.affinityTags || null,
      extractedInfo: insertInteraction.extractedInfo || null,
      qualityScore: insertInteraction.qualityScore || null,
      qualityExplanation: insertInteraction.qualityExplanation || null,
      qualityRecommendations: insertInteraction.qualityRecommendations || null,
      bbecSubmitted: insertInteraction.bbecSubmitted || false,
      bbecInteractionId: insertInteraction.bbecInteractionId || null,
      isDraft: insertInteraction.isDraft || false
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
      bbecId: insertTag.bbecId || null,
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

  async clearAffinityTags(): Promise<void> {
    this.affinityTags.clear();
    this.currentAffinityTagId = 1;
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
      createdAt: new Date(),
      transcript: insertRecording.transcript || null,
      audioData: insertRecording.audioData || null,
      duration: insertRecording.duration || null,
      processed: insertRecording.processed || null,
      interactionId: insertRecording.interactionId || null
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

  // Affinity tag settings methods
  private affinityTagSettings: AffinityTagSettings | undefined;

  async getAffinityTagSettings(): Promise<AffinityTagSettings | undefined> {
    return this.affinityTagSettings;
  }

  async updateAffinityTagSettings(settings: InsertAffinityTagSettings): Promise<void> {
    this.affinityTagSettings = {
      id: 1,
      autoRefresh: settings.autoRefresh || null,
      refreshInterval: settings.refreshInterval || null,
      lastRefresh: settings.lastRefresh || null,
      totalTags: settings.totalTags || null,
      nextRefresh: settings.nextRefresh || null,
      matchingThreshold: settings.matchingThreshold || null,
      updatedAt: new Date()
    };
  }
}

// Database Storage Implementation
export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async updateUser(id: number, updates: Partial<InsertUser>): Promise<User> {
    const [user] = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async getInteraction(id: number): Promise<Interaction | undefined> {
    const [interaction] = await db.select().from(interactions).where(eq(interactions.id, id));
    return interaction || undefined;
  }

  async getInteractionsByUser(userId: number): Promise<Interaction[]> {
    return await db.select().from(interactions).where(eq(interactions.userId, userId)).orderBy(desc(interactions.createdAt));
  }

  async getRecentInteractions(userId: number, limit: number = 10): Promise<Interaction[]> {
    return await db.select().from(interactions)
      .where(eq(interactions.userId, userId))
      .orderBy(desc(interactions.createdAt))
      .limit(limit);
  }

  async createInteraction(interaction: InsertInteraction): Promise<Interaction> {
    const [result] = await db.insert(interactions).values({
      ...interaction,
      userId: 1 // Default user ID
    }).returning();
    return result;
  }

  async updateInteraction(id: number, updates: Partial<InsertInteraction>): Promise<Interaction> {
    const [interaction] = await db
      .update(interactions)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(interactions.id, id))
      .returning();
    return interaction;
  }

  async deleteInteraction(id: number): Promise<boolean> {
    const result = await db.delete(interactions).where(eq(interactions.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  async getDraftInteractions(userId: number): Promise<Interaction[]> {
    return await db.select().from(interactions)
      .where(eq(interactions.userId, userId))
      .orderBy(desc(interactions.createdAt));
  }

  async getPendingInteractions(userId: number): Promise<Interaction[]> {
    return await db.select().from(interactions)
      .where(eq(interactions.userId, userId))
      .orderBy(desc(interactions.createdAt));
  }

  async getAffinityTags(): Promise<AffinityTag[]> {
    return await db.select().from(affinityTags).orderBy(affinityTags.name);
  }

  async createAffinityTag(insertTag: InsertAffinityTag): Promise<AffinityTag> {
    const [tag] = await db
      .insert(affinityTags)
      .values(insertTag)
      .returning();
    return tag;
  }

  async updateAffinityTags(tags: InsertAffinityTag[]): Promise<void> {
    if (tags.length === 0) return;

    // Since we clear all tags before updating, we can do a simple bulk insert
    const tagsWithTimestamp = tags.map(tag => ({
      ...tag,
      lastSynced: new Date()
    }));

    await db.insert(affinityTags).values(tagsWithTimestamp);
  }

  async getVoiceRecording(id: number): Promise<VoiceRecording | undefined> {
    const [recording] = await db.select().from(voiceRecordings).where(eq(voiceRecordings.id, id));
    return recording || undefined;
  }

  async createVoiceRecording(insertRecording: InsertVoiceRecording): Promise<VoiceRecording> {
    const [recording] = await db
      .insert(voiceRecordings)
      .values(insertRecording)
      .returning();
    return recording;
  }

  async updateVoiceRecording(id: number, updates: Partial<InsertVoiceRecording>): Promise<VoiceRecording> {
    const [recording] = await db
      .update(voiceRecordings)
      .set(updates)
      .where(eq(voiceRecordings.id, id))
      .returning();
    return recording;
  }

  async getUnprocessedRecordings(userId: number): Promise<VoiceRecording[]> {
    return await db.select().from(voiceRecordings)
      .where(eq(voiceRecordings.userId, userId))
      .orderBy(desc(voiceRecordings.createdAt));
  }

  async getAffinityTagSettings(): Promise<AffinityTagSettings | undefined> {
    const [settings] = await db.select().from(affinityTagSettings).limit(1);
    return settings || undefined;
  }

  async updateAffinityTagSettings(settingsData: InsertAffinityTagSettings): Promise<void> {
    const existingSettings = await this.getAffinityTagSettings();

    if (existingSettings) {
      await db
        .update(affinityTagSettings)
        .set({
          ...settingsData,
          updatedAt: new Date()
        })
        .where(eq(affinityTagSettings.id, existingSettings.id));
    } else {
      await db
        .insert(affinityTagSettings)
        .values({
          ...settingsData,
          updatedAt: new Date()
        });
    }
  }

  async clearAffinityTags(): Promise<void> {
    await db.delete(affinityTags);
  }
}

export const storage = new DatabaseStorage();