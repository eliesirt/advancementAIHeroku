import {
  users,
  interactions,
  affinityTags,
  voiceRecordings,
  affinityTagSettings,
  aiPromptSettings,
  roles,
  applications,
  userRoles,
  roleApplications,
  type User,
  type InsertUser,
  type UpsertUser,
  type Interaction,
  type InsertInteraction,
  type AffinityTag,
  type InsertAffinityTag,
  type VoiceRecording,
  type InsertVoiceRecording,
  type AffinityTagSettings,
  type InsertAffinityTagSettings,
  type AiPromptSettings,
  type InsertAiPromptSettings,
  type Role,
  type InsertRole,
  type Application,
  type InsertApplication,
  type UserRole,
  type InsertUserRole,
  type RoleApplication,
  type InsertRoleApplication,
  type UserWithRoles,
  type ApplicationWithPermissions
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and } from "drizzle-orm";

export interface IStorage {
  // User methods (updated for string IDs and authentication)
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>; // For Replit Auth
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<InsertUser>): Promise<User>;
  getUserWithRoles(id: string): Promise<UserWithRoles | undefined>;

  // Role methods
  getRoles(): Promise<Role[]>;
  getRole(id: number): Promise<Role | undefined>;
  createRole(role: InsertRole): Promise<Role>;
  updateRole(id: number, updates: Partial<InsertRole>): Promise<Role>;
  deleteRole(id: number): Promise<boolean>;

  // Application methods
  getApplications(): Promise<Application[]>;
  getApplication(id: number): Promise<Application | undefined>;
  createApplication(app: InsertApplication): Promise<Application>;
  updateApplication(id: number, updates: Partial<InsertApplication>): Promise<Application>;
  deleteApplication(id: number): Promise<boolean>;
  getUserApplications(userId: string): Promise<ApplicationWithPermissions[]>;

  // User role assignment methods
  assignUserRole(userId: string, roleId: number, assignedBy?: string): Promise<UserRole>;
  removeUserRole(userId: string, roleId: number): Promise<boolean>;
  getUserRoles(userId: string): Promise<Role[]>;

  // Role application methods
  assignRoleApplication(roleId: number, applicationId: number, permissions: string[]): Promise<RoleApplication>;
  removeRoleApplication(roleId: number, applicationId: number): Promise<boolean>;
  getRoleApplications(roleId: number): Promise<RoleApplication[]>;

  // Interaction methods (updated for string user IDs)
  getInteraction(id: number): Promise<Interaction | undefined>;
  getInteractionsByUser(userId: string): Promise<Interaction[]>;
  getRecentInteractions(userId: string, limit?: number): Promise<Interaction[]>;
  createInteraction(interaction: InsertInteraction): Promise<Interaction>;
  updateInteraction(id: number, updates: Partial<InsertInteraction>): Promise<Interaction>;
  deleteInteraction(id: number): Promise<boolean>;
  getDraftInteractions(userId: string): Promise<Interaction[]>;
  getPendingInteractions(userId: string): Promise<Interaction[]>;

  // Affinity tag methods
  getAffinityTags(): Promise<AffinityTag[]>;
  createAffinityTag(tag: InsertAffinityTag): Promise<AffinityTag>;
  updateAffinityTags(tags: InsertAffinityTag[]): Promise<void>;
  clearAffinityTags(): Promise<void>;

  // Affinity tag settings methods
  getAffinityTagSettings(): Promise<AffinityTagSettings | undefined>;
  updateAffinityTagSettings(settings: InsertAffinityTagSettings): Promise<void>;

  // AI prompt settings methods (updated for string user IDs)
  getAiPromptSettings(userId: string, promptType: string): Promise<AiPromptSettings | undefined>;
  createAiPromptSettings(settings: InsertAiPromptSettings): Promise<AiPromptSettings>;
  updateAiPromptSettings(id: number, updates: Partial<InsertAiPromptSettings>): Promise<AiPromptSettings>;
  getUserAiPromptSettings(userId: string): Promise<AiPromptSettings[]>;

  // Voice recording methods (updated for string user IDs)
  getVoiceRecording(id: number): Promise<VoiceRecording | undefined>;
  createVoiceRecording(recording: InsertVoiceRecording): Promise<VoiceRecording>;
  updateVoiceRecording(id: number, updates: Partial<InsertVoiceRecording>): Promise<VoiceRecording>;
  getUnprocessedRecordings(userId: string): Promise<VoiceRecording[]>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private interactions: Map<number, Interaction>;
  private affinityTags: Map<number, AffinityTag>;
  private voiceRecordings: Map<number, VoiceRecording>;
  private roles: Map<number, Role>;
  private applications: Map<number, Application>;
  private userRoles: Map<string, number[]>;
  private roleApplications: Map<number, Map<number, string[]>>;
  private currentInteractionId: number;
  private currentAffinityTagId: number;
  private currentVoiceRecordingId: number;
  private currentRoleId: number;
  private currentApplicationId: number;

  constructor() {
    this.users = new Map();
    this.interactions = new Map();
    this.affinityTags = new Map();
    this.voiceRecordings = new Map();
    this.roles = new Map();
    this.applications = new Map();
    this.userRoles = new Map();
    this.roleApplications = new Map();
    this.currentInteractionId = 1;
    this.currentAffinityTagId = 1;
    this.currentVoiceRecordingId = 1;
    this.currentRoleId = 1;
    this.currentApplicationId = 1;

    // Initialize with default data
    this.initializeDefaultData();
  }

  private initializeDefaultData() {
    // Create default user
    const defaultUserId = "default-user-1";
    const defaultUser: User = {
      id: defaultUserId,
      username: "sarah.thompson",
      password: "hashed_password",
      firstName: "Sarah",
      lastName: "Thompson",
      email: "sarah.thompson@example.com",
      profileImageUrl: null,
      buid: null,
      bbecGuid: null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.users.set(defaultUserId, defaultUser);

    // Create default roles
    const adminRole: Role = {
      id: 1,
      name: "Administrator",
      description: "Full system access",
      isSystemRole: true,
      createdAt: new Date(),
    };
    const userRole: Role = {
      id: 2,
      name: "User",
      description: "Standard user access",
      isSystemRole: true,
      createdAt: new Date(),
    };
    this.roles.set(1, adminRole);
    this.roles.set(2, userRole);
    this.currentRoleId = 3;

    // Create default applications
    const interactionApp: Application = {
      id: 1,
      name: "interaction-manager",
      displayName: "Interaction Manager",
      description: "Manage prospect interactions and CRM data",
      route: "/apps/interactions",
      icon: "users",
      color: "blue",
      isActive: true,
      sortOrder: 1,
      createdAt: new Date(),
    };
    this.applications.set(1, interactionApp);
    this.currentApplicationId = 2;

    // Assign default user admin role
    this.userRoles.set(defaultUserId, [1]); // Admin role

    // Grant admin role access to all applications
    this.roleApplications.set(1, new Map([[1, ["read", "write", "admin"]]]));

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
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.username === username);
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const existingUser = userData.id ? this.users.get(userData.id) : undefined;
    
    if (existingUser) {
      const updatedUser: User = {
        ...existingUser,
        ...userData,
        updatedAt: new Date(),
      };
      this.users.set(userData.id!, updatedUser);
      return updatedUser;
    } else {
      const id = userData.id || `user-${Date.now()}`;
      const newUser: User = {
        ...userData,
        id,
        email: userData.email ?? null,
        firstName: userData.firstName ?? null,
        lastName: userData.lastName ?? null,
        profileImageUrl: userData.profileImageUrl ?? null,
        username: userData.username ?? null,
        password: userData.password ?? null,
        buid: userData.buid ?? null,
        bbecGuid: userData.bbecGuid ?? null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.users.set(id, newUser);
      return newUser;
    }
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = insertUser.id || `user-${Date.now()}`;
    const user: User = {
      ...insertUser,
      id,
      email: insertUser.email ?? null,
      firstName: insertUser.firstName ?? null,
      lastName: insertUser.lastName ?? null,
      profileImageUrl: insertUser.profileImageUrl ?? null,
      username: insertUser.username ?? null,
      password: insertUser.password ?? null,
      buid: insertUser.buid ?? null,
      bbecGuid: insertUser.bbecGuid ?? null,
      isActive: insertUser.isActive ?? true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.users.set(id, user);
    return user;
  }

  async updateUser(id: string, updates: Partial<InsertUser>): Promise<User> {
    const existingUser = this.users.get(id);
    if (!existingUser) {
      throw new Error(`User with id ${id} not found`);
    }

    const updatedUser: User = {
      ...existingUser,
      ...updates,
      updatedAt: new Date(),
    };

    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async getUserWithRoles(id: string): Promise<UserWithRoles | undefined> {
    const user = await this.getUser(id);
    if (!user) return undefined;

    const roleIds = this.userRoles.get(id) || [];
    const roles = roleIds.map(roleId => this.roles.get(roleId)).filter(Boolean) as Role[];
    const applications = await this.getUserApplications(id);

    return { ...user, roles, applications };
  }

  // Interaction methods
  async getInteraction(id: number): Promise<Interaction | undefined> {
    return this.interactions.get(id);
  }

  async getInteractionsByUser(userId: string): Promise<Interaction[]> {
    return Array.from(this.interactions.values())
      .filter(interaction => interaction.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getRecentInteractions(userId: string, limit: number = 10): Promise<Interaction[]> {
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
      userId: insertInteraction.userId || "default-user-1",
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

  async getDraftInteractions(userId: string): Promise<Interaction[]> {
    return Array.from(this.interactions.values())
      .filter(interaction => interaction.userId === userId && interaction.isDraft)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  async getPendingInteractions(userId: string): Promise<Interaction[]> {
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

  async getUnprocessedRecordings(userId: string): Promise<VoiceRecording[]> {
    return Array.from(this.voiceRecordings.values())
      .filter(recording => recording.userId === userId && !recording.processed)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  // Role methods
  async getRoles(): Promise<Role[]> {
    return Array.from(this.roles.values()).sort((a, b) => a.name.localeCompare(b.name));
  }

  async getRole(id: number): Promise<Role | undefined> {
    return this.roles.get(id);
  }

  async createRole(insertRole: InsertRole): Promise<Role> {
    const id = this.currentRoleId++;
    const role: Role = {
      ...insertRole,
      id,
      description: insertRole.description ?? null,
      isSystemRole: insertRole.isSystemRole ?? false,
      createdAt: new Date(),
    };
    this.roles.set(id, role);
    return role;
  }

  async updateRole(id: number, updates: Partial<InsertRole>): Promise<Role> {
    const existingRole = this.roles.get(id);
    if (!existingRole) {
      throw new Error(`Role with id ${id} not found`);
    }
    const updatedRole: Role = {
      ...existingRole,
      ...updates,
    };
    this.roles.set(id, updatedRole);
    return updatedRole;
  }

  async deleteRole(id: number): Promise<boolean> {
    const role = this.roles.get(id);
    if (role?.isSystemRole) {
      throw new Error("Cannot delete system roles");
    }
    return this.roles.delete(id);
  }

  // Application methods
  async getApplications(): Promise<Application[]> {
    return Array.from(this.applications.values()).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  }

  async getApplication(id: number): Promise<Application | undefined> {
    return this.applications.get(id);
  }

  async createApplication(insertApp: InsertApplication): Promise<Application> {
    const id = this.currentApplicationId++;
    const app: Application = {
      ...insertApp,
      id,
      description: insertApp.description ?? null,
      icon: insertApp.icon ?? null,
      color: insertApp.color ?? null,
      isActive: insertApp.isActive ?? true,
      sortOrder: insertApp.sortOrder ?? 0,
      createdAt: new Date(),
    };
    this.applications.set(id, app);
    return app;
  }

  async updateApplication(id: number, updates: Partial<InsertApplication>): Promise<Application> {
    const existingApp = this.applications.get(id);
    if (!existingApp) {
      throw new Error(`Application with id ${id} not found`);
    }
    const updatedApp: Application = {
      ...existingApp,
      ...updates,
    };
    this.applications.set(id, updatedApp);
    return updatedApp;
  }

  async deleteApplication(id: number): Promise<boolean> {
    return this.applications.delete(id);
  }

  async getUserApplications(userId: string): Promise<ApplicationWithPermissions[]> {
    const userRoleIds = this.userRoles.get(userId) || [];
    const applications = new Map<number, string[]>();

    for (const roleId of userRoleIds) {
      const roleApps = this.roleApplications.get(roleId);
      if (roleApps) {
        for (const [appId, permissions] of roleApps) {
          const existingPermissions = applications.get(appId) || [];
          const combinedPermissions = [...new Set([...existingPermissions, ...permissions])];
          applications.set(appId, combinedPermissions);
        }
      }
    }

    const result: ApplicationWithPermissions[] = [];
    for (const [appId, permissions] of applications) {
      const app = this.applications.get(appId);
      if (app && app.isActive) {
        result.push({ ...app, permissions });
      }
    }

    return result.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  }

  // User role assignment methods
  async assignUserRole(userId: string, roleId: number, assignedBy?: string): Promise<UserRole> {
    const existingRoles = this.userRoles.get(userId) || [];
    if (!existingRoles.includes(roleId)) {
      existingRoles.push(roleId);
      this.userRoles.set(userId, existingRoles);
    }

    return {
      id: Date.now(), // Simple ID for memory storage
      userId,
      roleId,
      assignedAt: new Date(),
      assignedBy: assignedBy || null,
    };
  }

  async removeUserRole(userId: string, roleId: number): Promise<boolean> {
    const existingRoles = this.userRoles.get(userId) || [];
    const updatedRoles = existingRoles.filter(id => id !== roleId);
    this.userRoles.set(userId, updatedRoles);
    return existingRoles.length > updatedRoles.length;
  }

  async getUserRoles(userId: string): Promise<Role[]> {
    const roleIds = this.userRoles.get(userId) || [];
    return roleIds.map(roleId => this.roles.get(roleId)).filter(Boolean) as Role[];
  }

  // Role application methods
  async assignRoleApplication(roleId: number, applicationId: number, permissions: string[]): Promise<RoleApplication> {
    let roleApps = this.roleApplications.get(roleId);
    if (!roleApps) {
      roleApps = new Map();
      this.roleApplications.set(roleId, roleApps);
    }
    roleApps.set(applicationId, permissions);

    return {
      id: Date.now(),
      roleId,
      applicationId,
      permissions,
      createdAt: new Date(),
    };
  }

  async removeRoleApplication(roleId: number, applicationId: number): Promise<boolean> {
    const roleApps = this.roleApplications.get(roleId);
    if (!roleApps) return false;
    return roleApps.delete(applicationId);
  }

  async getRoleApplications(roleId: number): Promise<RoleApplication[]> {
    const roleApps = this.roleApplications.get(roleId);
    if (!roleApps) return [];

    const result: RoleApplication[] = [];
    for (const [applicationId, permissions] of roleApps) {
      result.push({
        id: Date.now() + applicationId,
        roleId,
        applicationId,
        permissions,
        createdAt: new Date(),
      });
    }
    return result;
  }

  // AI prompt settings methods
  private aiPromptSettings: Map<string, AiPromptSettings[]> = new Map();

  async getAiPromptSettings(userId: string, promptType: string): Promise<AiPromptSettings | undefined> {
    const userSettings = this.aiPromptSettings.get(userId) || [];
    return userSettings.find(s => s.promptType === promptType);
  }

  async createAiPromptSettings(settingsData: InsertAiPromptSettings): Promise<AiPromptSettings> {
    const settings: AiPromptSettings = {
      ...settingsData,
      id: Date.now(),
      isDefault: settingsData.isDefault ?? false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const userSettings = this.aiPromptSettings.get(settingsData.userId) || [];
    userSettings.push(settings);
    this.aiPromptSettings.set(settingsData.userId, userSettings);

    return settings;
  }

  async updateAiPromptSettings(id: number, updates: Partial<InsertAiPromptSettings>): Promise<AiPromptSettings> {
    for (const [userId, userSettings] of this.aiPromptSettings) {
      const index = userSettings.findIndex(s => s.id === id);
      if (index !== -1) {
        const updated = {
          ...userSettings[index],
          ...updates,
          updatedAt: new Date(),
        };
        userSettings[index] = updated;
        return updated;
      }
    }
    throw new Error(`AI prompt settings with id ${id} not found`);
  }

  async getUserAiPromptSettings(userId: string): Promise<AiPromptSettings[]> {
    return this.aiPromptSettings.get(userId) || [];
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
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    if (!username) return undefined;
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async updateUser(id: string, updates: Partial<InsertUser>): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async getUserWithRoles(id: string): Promise<UserWithRoles | undefined> {
    const user = await this.getUser(id);
    if (!user) return undefined;

    const userRolesList = await this.getUserRoles(id);
    const userApplications = await this.getUserApplications(id);

    return { ...user, roles: userRolesList, applications: userApplications };
  }

  async getInteraction(id: number): Promise<Interaction | undefined> {
    const [interaction] = await db.select().from(interactions).where(eq(interactions.id, id));
    return interaction || undefined;
  }

  async getInteractionsByUser(userId: string): Promise<Interaction[]> {
    return await db.select().from(interactions).where(eq(interactions.userId, userId)).orderBy(desc(interactions.createdAt));
  }

  async getRecentInteractions(userId: string, limit: number = 10): Promise<Interaction[]> {
    return await db.select().from(interactions)
      .where(eq(interactions.userId, userId))
      .orderBy(desc(interactions.createdAt))
      .limit(limit);
  }

  async createInteraction(interaction: InsertInteraction): Promise<Interaction> {
    const [result] = await db.insert(interactions).values({
      ...interaction,
      userId: interaction.userId || "default-user-1"
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

  async getDraftInteractions(userId: string): Promise<Interaction[]> {
    return await db.select().from(interactions)
      .where(and(eq(interactions.userId, userId), eq(interactions.isDraft, true)))
      .orderBy(desc(interactions.createdAt));
  }

  async getPendingInteractions(userId: string): Promise<Interaction[]> {
    return await db.select().from(interactions)
      .where(and(
        eq(interactions.userId, userId),
        eq(interactions.bbecSubmitted, false),
        eq(interactions.isDraft, false)
      ))
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

  async getUnprocessedRecordings(userId: string): Promise<VoiceRecording[]> {
    return await db.select().from(voiceRecordings)
      .where(and(
        eq(voiceRecordings.userId, userId),
        eq(voiceRecordings.processed, false)
      ))
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

  async getAiPromptSettings(userId: string, promptType: string): Promise<AiPromptSettings | undefined> {
    const [settings] = await db
      .select()
      .from(aiPromptSettings)
      .where(and(
        eq(aiPromptSettings.userId, userId),
        eq(aiPromptSettings.promptType, promptType)
      ))
      .limit(1);
    return settings || undefined;
  }

  async createAiPromptSettings(settingsData: InsertAiPromptSettings): Promise<AiPromptSettings> {
    const [settings] = await db
      .insert(aiPromptSettings)
      .values(settingsData)
      .returning();
    return settings;
  }

  async updateAiPromptSettings(id: number, updates: Partial<InsertAiPromptSettings>): Promise<AiPromptSettings> {
    const [settings] = await db
      .update(aiPromptSettings)
      .set({
        ...updates,
        updatedAt: new Date()
      })
      .where(eq(aiPromptSettings.id, id))
      .returning();
    return settings;
  }

  async getUserAiPromptSettings(userId: string): Promise<AiPromptSettings[]> {
    return await db
      .select()
      .from(aiPromptSettings)
      .where(eq(aiPromptSettings.userId, userId))
      .orderBy(aiPromptSettings.promptType);
  }

  // Role methods
  async getRoles(): Promise<Role[]> {
    return await db.select().from(roles).orderBy(roles.name);
  }

  async getRole(id: number): Promise<Role | undefined> {
    const [role] = await db.select().from(roles).where(eq(roles.id, id));
    return role || undefined;
  }

  async createRole(insertRole: InsertRole): Promise<Role> {
    const [role] = await db.insert(roles).values(insertRole).returning();
    return role;
  }

  async updateRole(id: number, updates: Partial<InsertRole>): Promise<Role> {
    const [role] = await db
      .update(roles)
      .set(updates)
      .where(eq(roles.id, id))
      .returning();
    return role;
  }

  async deleteRole(id: number): Promise<boolean> {
    const [role] = await db.select().from(roles).where(eq(roles.id, id));
    if (role?.isSystemRole) {
      throw new Error("Cannot delete system roles");
    }
    const result = await db.delete(roles).where(eq(roles.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // Application methods
  async getApplications(): Promise<Application[]> {
    return await db.select().from(applications).where(eq(applications.isActive, true)).orderBy(applications.sortOrder);
  }

  async getApplication(id: number): Promise<Application | undefined> {
    const [app] = await db.select().from(applications).where(eq(applications.id, id));
    return app || undefined;
  }

  async createApplication(insertApp: InsertApplication): Promise<Application> {
    const [app] = await db.insert(applications).values(insertApp).returning();
    return app;
  }

  async updateApplication(id: number, updates: Partial<InsertApplication>): Promise<Application> {
    const [app] = await db
      .update(applications)
      .set(updates)
      .where(eq(applications.id, id))
      .returning();
    return app;
  }

  async deleteApplication(id: number): Promise<boolean> {
    const result = await db.delete(applications).where(eq(applications.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  async getUserApplications(userId: string): Promise<ApplicationWithPermissions[]> {
    const userRolesList = await db
      .select()
      .from(userRoles)
      .where(eq(userRoles.userId, userId));

    if (userRolesList.length === 0) return [];

    const roleIds = userRolesList.map(ur => ur.roleId);
    
    const roleApplicationsList = await db
      .select({
        id: roleApplications.id,
        roleId: roleApplications.roleId,
        applicationId: roleApplications.applicationId,
        permissions: roleApplications.permissions,
        createdAt: roleApplications.createdAt,
        application: applications,
      })
      .from(roleApplications)
      .innerJoin(applications, eq(roleApplications.applicationId, applications.id))
      .where(and(
        eq(applications.isActive, true)
      ));

    const permissionMap = new Map<number, Set<string>>();
    
    roleApplicationsList.forEach(ra => {
      if (roleIds.includes(ra.roleId)) {
        const existing = permissionMap.get(ra.applicationId) || new Set();
        ra.permissions.forEach(p => existing.add(p));
        permissionMap.set(ra.applicationId, existing);
      }
    });

    const result: ApplicationWithPermissions[] = [];
    for (const [appId, permissionSet] of permissionMap) {
      const roleApp = roleApplicationsList.find(ra => ra.applicationId === appId);
      if (roleApp) {
        result.push({
          ...roleApp.application,
          permissions: Array.from(permissionSet),
        });
      }
    }

    return result.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  }

  // User role assignment methods
  async assignUserRole(userId: string, roleId: number, assignedBy?: string): Promise<UserRole> {
    const [userRole] = await db
      .insert(userRoles)
      .values({ userId, roleId, assignedBy })
      .onConflictDoNothing()
      .returning();
    return userRole;
  }

  async removeUserRole(userId: string, roleId: number): Promise<boolean> {
    const result = await db
      .delete(userRoles)
      .where(and(eq(userRoles.userId, userId), eq(userRoles.roleId, roleId)));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  async getUserRoles(userId: string): Promise<Role[]> {
    const userRolesList = await db
      .select({ role: roles })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(eq(userRoles.userId, userId));
    
    return userRolesList.map(ur => ur.role);
  }

  // Role application methods
  async assignRoleApplication(roleId: number, applicationId: number, permissions: string[]): Promise<RoleApplication> {
    const [roleApp] = await db
      .insert(roleApplications)
      .values({ roleId, applicationId, permissions })
      .onConflictDoUpdate({
        target: [roleApplications.roleId, roleApplications.applicationId],
        set: { permissions },
      })
      .returning();
    return roleApp;
  }

  async removeRoleApplication(roleId: number, applicationId: number): Promise<boolean> {
    const result = await db
      .delete(roleApplications)
      .where(and(eq(roleApplications.roleId, roleId), eq(roleApplications.applicationId, applicationId)));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  async getRoleApplications(roleId: number): Promise<RoleApplication[]> {
    return await db
      .select()
      .from(roleApplications)
      .where(eq(roleApplications.roleId, roleId));
  }
}

export const storage = new DatabaseStorage();