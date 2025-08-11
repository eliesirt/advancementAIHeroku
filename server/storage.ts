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
  prospects,
  prospectRelationships,
  prospectEvents,
  prospectBadges,
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
  type ApplicationWithPermissions,
  type Prospect,
  type InsertProspect,
  type ProspectWithDetails,
  type ProspectRelationship,
  type InsertProspectRelationship,
  type ProspectEvent,
  type InsertProspectEvent,
  type ProspectBadge,
  type InsertProspectBadge,
  itineraries,
  itineraryMeetings,
  itineraryTravelSegments,
  type Itinerary,
  type InsertItinerary,
  type ItineraryMeeting,
  type InsertItineraryMeeting,
  type ItineraryTravelSegment,
  type InsertItineraryTravelSegment
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, or, sql, inArray } from "drizzle-orm";

export interface IStorage {
  // User methods (updated for string IDs and authentication)
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(userData: Partial<User>): Promise<User>;
  upsertUser(user: UpsertUser): Promise<User>; // For Replit Auth
  updateUser(id: string, updates: Partial<User>): Promise<User>;
  getUserWithRoles(id: string): Promise<(User & { roles?: Role[] }) | undefined>;
  getAllUsersWithRoles(): Promise<(User & { roles?: Role[] })[]>;
  getUserApplications(userId: string): Promise<Application[]>;

  // Role methods
  getRoles(): Promise<Role[]>;
  createRole(roleData: Partial<Role>): Promise<Role>;
  updateRole(id: number, updates: Partial<Role>): Promise<Role>;
  deleteRole(id: number): Promise<boolean>;
  getUserRoles(userId: string): Promise<Role[]>;

  // User role assignment methods
  assignUserRole(userId: string, roleId: number, assignedBy?: string): Promise<UserRole>;
  removeUserRole(userId: string, roleId: number): Promise<boolean>;

  // Role application methods
  assignRoleApplication(roleId: number, applicationId: number, permissions: string[]): Promise<RoleApplication>;
  removeRoleApplication(roleId: number, applicationId: number): Promise<boolean>;
  getRoleApplications(roleId: number): Promise<RoleApplication[]>;

  // Application methods
  getApplications(): Promise<Application[]>;
  getApplication(id: number): Promise<Application | undefined>;
  createApplication(app: InsertApplication): Promise<Application>;
  updateApplication(id: number, updates: Partial<InsertApplication>): Promise<Application>;
  deleteApplication(id: number): Promise<boolean>;

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

  // Prospect management methods
  getProspects(prospectManagerId?: string): Promise<ProspectWithDetails[]>;
  getProspectsByManager(prospectManagerId: string): Promise<ProspectWithDetails[]>;
  getProspect(id: number): Promise<ProspectWithDetails | undefined>;
  createProspect(prospect: InsertProspect): Promise<Prospect>;
  updateProspect(id: number, updates: Partial<InsertProspect>): Promise<Prospect>;
  deleteProspect(id: number): Promise<boolean>;
  refreshProspectData(id: number): Promise<Prospect>;
  refreshAllProspectData(prospectManagerId: string): Promise<void>;

  // Prospect relationship methods
  getProspectRelationships(prospectId: number): Promise<ProspectRelationship[]>;
  createProspectRelationship(relationship: InsertProspectRelationship): Promise<ProspectRelationship>;
  deleteProspectRelationship(id: number): Promise<boolean>;

  // Prospect event methods
  getProspectEvents(prospectId: number): Promise<ProspectEvent[]>;
  createProspectEvent(event: InsertProspectEvent): Promise<ProspectEvent>;
  deleteProspectEvent(id: number): Promise<boolean>;

  // Prospect badge methods
  getProspectBadges(prospectId: number): Promise<ProspectBadge[]>;
  createProspectBadge(badge: InsertProspectBadge): Promise<ProspectBadge>;
  deleteProspectBadge(id: number): Promise<boolean>;

  // Itinerary methods
  getItineraries(userId: string): Promise<Itinerary[]>;
  getItinerary(id: number): Promise<Itinerary | undefined>;
  createItinerary(itinerary: InsertItinerary): Promise<Itinerary>;
  updateItinerary(id: number, updates: Partial<InsertItinerary>): Promise<Itinerary>;
  deleteItinerary(id: number): Promise<boolean>;

  // Itinerary meeting methods
  getItineraryMeetings(itineraryId: number): Promise<(ItineraryMeeting & { prospect: Prospect })[]>;
  createItineraryMeeting(meeting: InsertItineraryMeeting): Promise<ItineraryMeeting>;
  updateItineraryMeeting(id: number, updates: Partial<InsertItineraryMeeting>): Promise<ItineraryMeeting>;
  deleteItineraryMeeting(id: number): Promise<boolean>;

  // Itinerary travel segment methods
  getItineraryTravelSegments(itineraryId: number): Promise<ItineraryTravelSegment[]>;
  createItineraryTravelSegment(segment: InsertItineraryTravelSegment): Promise<ItineraryTravelSegment>;
  updateItineraryTravelSegment(id: number, updates: Partial<InsertItineraryTravelSegment>): Promise<ItineraryTravelSegment>;
  deleteItineraryTravelSegment(id: number): Promise<boolean>;

  // Admin methods
  getAllUsersWithRoles(): Promise<UserWithRoles[]>;
  getAllApplications(): Promise<Application[]>;
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

  async createUser(userData: Partial<User>): Promise<User> {
    const id = userData.id || `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newUserData: User = {
      id,
      email: userData.email || null,
      firstName: userData.firstName || null,
      lastName: userData.lastName || null,
      profileImageUrl: userData.profileImageUrl || null,
      username: userData.username || userData.email || null,
      password: userData.password || null,
      buid: userData.buid || null,
      bbecGuid: userData.bbecGuid || null,
      isActive: userData.isActive !== undefined ? userData.isActive : true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.users.set(id, newUserData);
    return newUserData;
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

  async updateUser(id: string, updates: Partial<User>): Promise<User> {
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

  async createRole(roleData: Partial<Role>): Promise<Role> {
    const id = this.currentRoleId++;
    const newRole: Role = {
      id,
      name: roleData.name || '',
      description: roleData.description || null,
      isSystemRole: roleData.isSystemRole ?? false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.roles.set(id, newRole);
    return newRole;
  }

  async updateRole(id: number, updates: Partial<Role>): Promise<Role> {
    const role = this.roles.get(id);
    if (!role) {
      throw new Error(`Role with id ${id} not found`);
    }
    const updatedRole: Role = {
      ...role,
      ...updates,
      updatedAt: new Date(),
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

  async updateAffinityTagSettings(settingsData: InsertAffinityTagSettings): Promise<void> {
    this.affinityTagSettings = {
      id: 1,
      autoRefresh: settingsData.autoRefresh || null,
      refreshInterval: settingsData.refreshInterval || null,
      lastRefresh: settingsData.lastRefresh || null,
      totalTags: settingsData.totalTags || null,
      nextRefresh: settingsData.nextRefresh || null,
      matchingThreshold: settingsData.matchingThreshold || null,
      updatedAt: new Date()
    };
  }

  // Admin methods
  async getAllUsersWithRoles(): Promise<UserWithRoles[]> {
    const allUsers = Array.from(this.users.values());
    return Promise.all(allUsers.map(async (user) => {
      const userRolesList = await this.getUserRoles(user.id);
      const userApplications = await this.getUserApplications(user.id);
      return { ...user, roles: userRolesList, applications: userApplications };
    }));
  }

  async getAllApplications(): Promise<Application[]> {
    return Array.from(this.applications.values()).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
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

  async createUser(userData: Partial<User>): Promise<User> {
    const id = userData.id || `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newUserData = {
      id,
      email: userData.email || null,
      firstName: userData.firstName || null,
      lastName: userData.lastName || null,
      profileImageUrl: userData.profileImageUrl || null,
      username: userData.username || userData.email || null,
      password: userData.password || null,
      buid: userData.buid || null,
      bbecGuid: userData.bbecGuid || null,
      isActive: userData.isActive !== undefined ? userData.isActive : true,
    };

    const result = await db.insert(users).values(newUserData).returning();
    return result[0];
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

  async updateUser(id: string, updates: Partial<User>): Promise<User> {
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

  async createRole(roleData: Partial<Role>): Promise<Role> {
    const newRoleData = {
      name: roleData.name || '',
      description: roleData.description || null,
    };

    const result = await db.insert(roles).values(newRoleData).returning();
    return result[0];
  }

  async updateRole(id: number, updates: Partial<Role>): Promise<Role> {
    const result = await db
      .update(roles)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(roles.id, id))
      .returning();

    if (result.length === 0) {
      throw new Error(`Role with id ${id} not found`);
    }

    return result[0];
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
        eq(applications.isActive, true),
        // Only include role applications for the user's roles
        roleIds.length > 0 ? 
          inArray(roleApplications.roleId, roleIds) :
          sql`false` // No roles, no applications
      ));

    const permissionMap = new Map<number, Set<string>>();

    roleApplicationsList.forEach(ra => {
      // No need to check roleIds.includes(ra.roleId) since we already filtered in SQL
      const existing = permissionMap.get(ra.applicationId) || new Set();
      ra.permissions.forEach(p => existing.add(p));
      permissionMap.set(ra.applicationId, existing);
    });

    const result: ApplicationWithPermissions[] = [];
    for (const [appId, permissionSet] of permissionMap) {
      const roleApp = roleApplicationsList.find(ra => ra.applicationId === appId);
      const permissions = Array.from(permissionSet);
      
      // Only include applications where user has at least one permission
      if (roleApp && permissions.length > 0) {
        result.push({
          ...roleApp.application,
          permissions: permissions,
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
    console.log('Storage: Assigning role application:', { roleId, applicationId, permissions });
    
    // First try to find existing record
    const existing = await db
      .select()
      .from(roleApplications)
      .where(and(
        eq(roleApplications.roleId, roleId),
        eq(roleApplications.applicationId, applicationId)
      ))
      .limit(1);

    if (existing.length > 0) {
      // Update existing record
      const [roleApp] = await db
        .update(roleApplications)
        .set({ permissions, createdAt: new Date() })
        .where(and(
          eq(roleApplications.roleId, roleId),
          eq(roleApplications.applicationId, applicationId)
        ))
        .returning();
      return roleApp;
    } else {
      // Insert new record
      const [roleApp] = await db
        .insert(roleApplications)
        .values({ roleId, applicationId, permissions })
        .returning();
      return roleApp;
    }
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

  // Admin methods
  async getAllUsersWithRoles(): Promise<UserWithRoles[]> {
    const usersData = await db.select().from(users);
    return Promise.all(usersData.map(async (user) => {
      const userRolesList = await this.getUserRoles(user.id);
      const userApplications = await this.getUserApplications(user.id);
      return { ...user, roles: userRolesList, applications: userApplications };
    }));
  }

  async getAllApplications(): Promise<Application[]> {
    return await db.select().from(applications).orderBy(applications.sortOrder);
  }

  // Prospect management methods
  async getProspects(prospectManagerId?: string): Promise<ProspectWithDetails[]> {
    let query = db.select().from(prospects);
    
    if (prospectManagerId) {
      query = query.where(eq(prospects.prospectManagerId, prospectManagerId));
    }
    
    const prospectsData = await query.orderBy(desc(prospects.updatedAt));
    
    return Promise.all(prospectsData.map(async (prospect) => {
      const [prospectManager, relationships, events, badges] = await Promise.all([
        prospect.prospectManagerId ? this.getUser(prospect.prospectManagerId) : undefined,
        this.getProspectRelationships(prospect.id),
        this.getProspectEvents(prospect.id),
        this.getProspectBadges(prospect.id)
      ]);

      return {
        ...prospect,
        prospectManager: prospectManager,
        relationships,
        events,
        badges
      };
    }));
  }

  async getProspectsByManager(prospectManagerId: string): Promise<ProspectWithDetails[]> {
    return this.getProspects(prospectManagerId);
  }

  async getProspect(id: number): Promise<ProspectWithDetails | undefined> {
    const [prospect] = await db.select().from(prospects).where(eq(prospects.id, id));
    
    if (!prospect) return undefined;

    const [prospectManager, relationships, events, badges] = await Promise.all([
      prospect.prospectManagerId ? this.getUser(prospect.prospectManagerId) : undefined,
      this.getProspectRelationships(prospect.id),
      this.getProspectEvents(prospect.id),
      this.getProspectBadges(prospect.id)
    ]);

    return {
      ...prospect,
      prospectManager: prospectManager,
      relationships,
      events,
      badges
    };
  }

  async createProspect(prospectData: InsertProspect): Promise<Prospect> {
    const [prospect] = await db.insert(prospects).values(prospectData).returning();
    return prospect;
  }

  async updateProspect(id: number, updates: Partial<InsertProspect>): Promise<Prospect> {
    const [prospect] = await db
      .update(prospects)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(prospects.id, id))
      .returning();
    return prospect;
  }

  async deleteProspect(id: number): Promise<boolean> {
    const result = await db.delete(prospects).where(eq(prospects.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  async refreshProspectData(id: number): Promise<Prospect> {
    // In a real implementation, this would fetch fresh data from CRM
    const [prospect] = await db
      .update(prospects)
      .set({ lastSyncedAt: new Date(), updatedAt: new Date() })
      .where(eq(prospects.id, id))
      .returning();
    return prospect;
  }

  async refreshAllProspectData(prospectManagerId: string): Promise<void> {
    // In a real implementation, this would batch refresh all prospects for a manager
    await db
      .update(prospects)
      .set({ lastSyncedAt: new Date(), updatedAt: new Date() })
      .where(eq(prospects.prospectManagerId, prospectManagerId));
  }

  // Prospect relationship methods
  async getProspectRelationships(prospectId: number): Promise<ProspectRelationship[]> {
    return await db
      .select()
      .from(prospectRelationships)
      .where(eq(prospectRelationships.prospectId, prospectId))
      .orderBy(prospectRelationships.createdAt);
  }

  async createProspectRelationship(relationship: InsertProspectRelationship): Promise<ProspectRelationship> {
    const [prospectRelationship] = await db
      .insert(prospectRelationships)
      .values(relationship)
      .returning();
    return prospectRelationship;
  }

  async deleteProspectRelationship(id: number): Promise<boolean> {
    const result = await db.delete(prospectRelationships).where(eq(prospectRelationships.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // Prospect event methods
  async getProspectEvents(prospectId: number): Promise<ProspectEvent[]> {
    return await db
      .select()
      .from(prospectEvents)
      .where(eq(prospectEvents.prospectId, prospectId))
      .orderBy(desc(prospectEvents.eventDate));
  }

  async createProspectEvent(event: InsertProspectEvent): Promise<ProspectEvent> {
    const [prospectEvent] = await db
      .insert(prospectEvents)
      .values(event)
      .returning();
    return prospectEvent;
  }

  async deleteProspectEvent(id: number): Promise<boolean> {
    const result = await db.delete(prospectEvents).where(eq(prospectEvents.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // Prospect badge methods
  async getProspectBadges(prospectId: number): Promise<ProspectBadge[]> {
    return await db
      .select()
      .from(prospectBadges)
      .where(eq(prospectBadges.prospectId, prospectId))
      .orderBy(desc(prospectBadges.achievedAt));
  }

  async createProspectBadge(badge: InsertProspectBadge): Promise<ProspectBadge> {
    const [prospectBadge] = await db
      .insert(prospectBadges)
      .values(badge)
      .returning();
    return prospectBadge;
  }

  async deleteProspectBadge(id: number): Promise<boolean> {
    const result = await db.delete(prospectBadges).where(eq(prospectBadges.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // Itinerary methods
  async getItineraries(userId: string): Promise<Itinerary[]> {
    return await db
      .select()
      .from(itineraries)
      .where(eq(itineraries.userId, userId))
      .orderBy(desc(itineraries.createdAt));
  }

  async getItinerary(id: number): Promise<Itinerary | undefined> {
    const [itinerary] = await db.select().from(itineraries).where(eq(itineraries.id, id));
    return itinerary || undefined;
  }

  async createItinerary(itinerary: InsertItinerary): Promise<Itinerary> {
    const [result] = await db.insert(itineraries).values(itinerary).returning();
    return result;
  }

  async updateItinerary(id: number, updates: Partial<InsertItinerary>): Promise<Itinerary> {
    const [itinerary] = await db
      .update(itineraries)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(itineraries.id, id))
      .returning();
    return itinerary;
  }

  async deleteItinerary(id: number): Promise<boolean> {
    const result = await db.delete(itineraries).where(eq(itineraries.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // Itinerary meeting methods
  async getItineraryMeetings(itineraryId: number): Promise<(ItineraryMeeting & { prospect: Prospect })[]> {
    return await db
      .select({
        id: itineraryMeetings.id,
        itineraryId: itineraryMeetings.itineraryId,
        prospectId: itineraryMeetings.prospectId,
        scheduledDate: itineraryMeetings.scheduledDate,
        scheduledTime: itineraryMeetings.scheduledTime,
        duration: itineraryMeetings.duration,
        meetingType: itineraryMeetings.meetingType,
        location: itineraryMeetings.location,
        notes: itineraryMeetings.notes,
        status: itineraryMeetings.status,
        sortOrder: itineraryMeetings.sortOrder,
        travelTimeFromPrevious: itineraryMeetings.travelTimeFromPrevious,
        distanceFromPrevious: itineraryMeetings.distanceFromPrevious,
        createdAt: itineraryMeetings.createdAt,
        prospect: prospects
      })
      .from(itineraryMeetings)
      .leftJoin(prospects, eq(itineraryMeetings.prospectId, prospects.id))
      .where(eq(itineraryMeetings.itineraryId, itineraryId))
      .orderBy(itineraryMeetings.sortOrder);
  }

  async createItineraryMeeting(meeting: InsertItineraryMeeting): Promise<ItineraryMeeting> {
    const [result] = await db.insert(itineraryMeetings).values(meeting).returning();
    return result;
  }

  async updateItineraryMeeting(id: number, updates: Partial<InsertItineraryMeeting>): Promise<ItineraryMeeting> {
    const [meeting] = await db
      .update(itineraryMeetings)
      .set(updates)
      .where(eq(itineraryMeetings.id, id))
      .returning();
    return meeting;
  }

  async deleteItineraryMeeting(id: number): Promise<boolean> {
    const result = await db.delete(itineraryMeetings).where(eq(itineraryMeetings.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // Itinerary travel segment methods
  async getItineraryTravelSegments(itineraryId: number): Promise<ItineraryTravelSegment[]> {
    return await db
      .select()
      .from(itineraryTravelSegments)
      .where(eq(itineraryTravelSegments.itineraryId, itineraryId))
      .orderBy(itineraryTravelSegments.sortOrder);
  }

  async createItineraryTravelSegment(segment: InsertItineraryTravelSegment): Promise<ItineraryTravelSegment> {
    const [result] = await db.insert(itineraryTravelSegments).values(segment).returning();
    return result;
  }

  async updateItineraryTravelSegment(id: number, updates: Partial<InsertItineraryTravelSegment>): Promise<ItineraryTravelSegment> {
    const [segment] = await db
      .update(itineraryTravelSegments)
      .set(updates)
      .where(eq(itineraryTravelSegments.id, id))
      .returning();
    return segment;
  }

  async deleteItineraryTravelSegment(id: number): Promise<boolean> {
    const result = await db.delete(itineraryTravelSegments).where(eq(itineraryTravelSegments.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // Admin methods - These should be at the end
  async getAllUsersWithRoles(): Promise<UserWithRoles[]> {
    const allUsers = await db.select().from(users).orderBy(users.email);
    
    const usersWithRoles = await Promise.all(
      allUsers.map(async (user) => {
        const userRolesList = await this.getUserRoles(user.id);
        const userApplications = await this.getUserApplications(user.id);
        return { ...user, roles: userRolesList, applications: userApplications };
      })
    );

    return usersWithRoles;
  }

  async getAllApplications(): Promise<Application[]> {
    return await db
      .select()
      .from(applications)
      .orderBy(applications.sortOrder);
  }
}

export const storage = new DatabaseStorage();