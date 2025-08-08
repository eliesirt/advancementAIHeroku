import { sql } from 'drizzle-orm';
import { pgTable, text, serial, integer, boolean, timestamp, jsonb, varchar, index, primaryKey } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Session storage table for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// Updated users table compatible with Replit Auth
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  // Legacy fields for backward compatibility and local auth
  username: text("username").unique(),
  password: text("password"), // For local accounts
  buid: text("buid"), // Blackbaud User ID
  bbecGuid: text("bbec_guid"), // Blackbaud GUID
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Roles table for role-based access control
export const roles = pgTable("roles", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  isSystemRole: boolean("is_system_role").default(false), // System roles cannot be deleted
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Applications table for the app suite
export const applications = pgTable("applications", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  displayName: text("display_name").notNull(),
  description: text("description"),
  route: text("route").notNull(), // URL route for the app
  icon: text("icon"), // Icon class or URL
  color: text("color"), // Theme color for the app card
  isActive: boolean("is_active").default(true),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// User roles assignment (many-to-many relationship)
export const userRoles = pgTable("user_roles", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  roleId: integer("role_id").notNull().references(() => roles.id, { onDelete: "cascade" }),
  assignedAt: timestamp("assigned_at").defaultNow().notNull(),
  assignedBy: varchar("assigned_by").references(() => users.id),
});

// Application permissions for roles
export const roleApplications = pgTable("role_applications", {
  id: serial("id").primaryKey(),
  roleId: integer("role_id").notNull().references(() => roles.id, { onDelete: "cascade" }),
  applicationId: integer("application_id").notNull().references(() => applications.id, { onDelete: "cascade" }),
  permissions: text("permissions").array().notNull().default(["read"]), // ['read', 'write', 'admin']
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  uniqueRoleApplication: index("unique_role_application_idx").on(table.roleId, table.applicationId),
}));

export const interactions = pgTable("interactions", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  prospectName: text("prospect_name").notNull(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  buid: text("buid"),
  bbecGuid: text("bbec_guid"),
  constituentGuid: text("constituent_guid"),
  owner: text("owner"),
  summary: text("summary").notNull(),
  category: text("category").notNull(),
  subcategory: text("subcategory").notNull(),
  contactLevel: text("contact_level").notNull(),
  method: text("method").notNull(),
  status: text("status").notNull().default('Complete'),
  actualDate: timestamp("actual_date").notNull(),
  comments: text("comments"),
  transcript: text("transcript"),
  affinityTags: text("affinity_tags").array(),
  extractedInfo: jsonb("extracted_info"),
  qualityScore: integer("quality_score"), // 0-25 based on rubric
  qualityExplanation: text("quality_explanation"), // AI explanation of score
  qualityRecommendations: text("quality_recommendations").array(), // AI improvement recommendations
  bbecSubmitted: boolean("bbec_submitted").default(false),
  bbecInteractionId: text("bbec_interaction_id"),
  isDraft: boolean("is_draft").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const affinityTags = pgTable("affinity_tags", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  bbecId: text("bbec_id"),
  lastSynced: timestamp("last_synced").defaultNow(),
});

export const voiceRecordings = pgTable("voice_recordings", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  audioData: text("audio_data"), // Base64 encoded audio
  transcript: text("transcript"),
  duration: integer("duration"), // seconds
  processed: boolean("processed").default(false),
  interactionId: integer("interaction_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const affinityTagSettings = pgTable("affinity_tag_settings", {
  id: serial("id").primaryKey(),
  autoRefresh: boolean("auto_refresh").default(false),
  refreshInterval: text("refresh_interval").default("daily"), // 'hourly', 'daily', 'weekly'
  lastRefresh: timestamp("last_refresh"),
  totalTags: integer("total_tags").default(0),
  nextRefresh: timestamp("next_refresh"),
  matchingThreshold: integer("matching_threshold").default(25), // 0-100, stored as integer for precision
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const aiPromptSettings = pgTable("ai_prompt_settings", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id), // Allow per-user customization
  promptType: text("prompt_type").notNull(), // 'synopsis', 'extraction', 'quality', etc.
  promptTemplate: text("prompt_template").notNull(),
  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Define relations
export const usersRelations = relations(users, ({ many }) => ({
  userRoles: many(userRoles),
  interactions: many(interactions),
  voiceRecordings: many(voiceRecordings),
  aiPromptSettings: many(aiPromptSettings),
}));

export const rolesRelations = relations(roles, ({ many }) => ({
  userRoles: many(userRoles),
  roleApplications: many(roleApplications),
}));

export const applicationsRelations = relations(applications, ({ many }) => ({
  roleApplications: many(roleApplications),
}));

export const userRolesRelations = relations(userRoles, ({ one }) => ({
  user: one(users, {
    fields: [userRoles.userId],
    references: [users.id],
  }),
  role: one(roles, {
    fields: [userRoles.roleId],
    references: [roles.id],
  }),
}));

export const roleApplicationsRelations = relations(roleApplications, ({ one }) => ({
  role: one(roles, {
    fields: [roleApplications.roleId],
    references: [roles.id],
  }),
  application: one(applications, {
    fields: [roleApplications.applicationId],
    references: [applications.id],
  }),
}));

export const interactionsRelations = relations(interactions, ({ one }) => ({
  user: one(users, {
    fields: [interactions.userId],
    references: [users.id],
  }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  createdAt: true,
  updatedAt: true,
});

export const upsertUserSchema = createInsertSchema(users).omit({
  createdAt: true,
  updatedAt: true,
});

export const insertRoleSchema = createInsertSchema(roles).omit({
  id: true,
  createdAt: true,
});

export const insertApplicationSchema = createInsertSchema(applications).omit({
  id: true,
  createdAt: true,
});

export const insertUserRoleSchema = createInsertSchema(userRoles).omit({
  id: true,
  assignedAt: true,
});

export const insertRoleApplicationSchema = createInsertSchema(roleApplications).omit({
  id: true,
  createdAt: true,
});

export const insertInteractionSchema = createInsertSchema(interactions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  actualDate: z.union([z.date(), z.string().transform((str) => new Date(str))]),
  userId: z.string().optional(),
});

export const insertAffinityTagSchema = createInsertSchema(affinityTags).omit({
  id: true,
  lastSynced: true,
});

export const insertVoiceRecordingSchema = createInsertSchema(voiceRecordings).omit({
  id: true,
  createdAt: true,
});

export const insertAffinityTagSettingsSchema = createInsertSchema(affinityTagSettings).omit({
  id: true,
  updatedAt: true,
});

export const insertAiPromptSettingsSchema = createInsertSchema(aiPromptSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Type exports
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type UpsertUser = z.infer<typeof upsertUserSchema>;
export type Role = typeof roles.$inferSelect;
export type InsertRole = z.infer<typeof insertRoleSchema>;
export type Application = typeof applications.$inferSelect;
export type InsertApplication = z.infer<typeof insertApplicationSchema>;
export type UserRole = typeof userRoles.$inferSelect;
export type InsertUserRole = z.infer<typeof insertUserRoleSchema>;
export type RoleApplication = typeof roleApplications.$inferSelect;
export type InsertRoleApplication = z.infer<typeof insertRoleApplicationSchema>;
export type Interaction = typeof interactions.$inferSelect;
export type InsertInteraction = z.infer<typeof insertInteractionSchema>;
export type AffinityTag = typeof affinityTags.$inferSelect;
export type InsertAffinityTag = z.infer<typeof insertAffinityTagSchema>;
export type VoiceRecording = typeof voiceRecordings.$inferSelect;
export type InsertVoiceRecording = z.infer<typeof insertVoiceRecordingSchema>;
export type AffinityTagSettings = typeof affinityTagSettings.$inferSelect;
export type InsertAffinityTagSettings = z.infer<typeof insertAffinityTagSettingsSchema>;
export type AiPromptSettings = typeof aiPromptSettings.$inferSelect;
export type InsertAiPromptSettings = z.infer<typeof insertAiPromptSettingsSchema>;

// Extended types for UI
export interface UserWithRoles extends User {
  roles?: Role[];
  applications?: Application[];
}

export interface RoleWithApplications extends Role {
  applications?: (RoleApplication & { application: Application })[];
}

export interface ApplicationWithPermissions extends Application {
  permissions?: string[];
}

export interface RoleWithApplications extends Role {
  applications?: RoleApplication[];
}

export interface ExtractedInteractionInfo {
  summary: string;
  category: string;
  subcategory: string;
  contactLevel: string;
  professionalInterests: string[];
  personalInterests: string[];
  philanthropicPriorities: string[];
  keyPoints: string[];
  suggestedAffinityTags: string[];
  prospectName: string;
}