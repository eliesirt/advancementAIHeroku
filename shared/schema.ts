import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  email: text("email"),
  buid: text("buid"), // Blackbaud User ID
  bbecGuid: text("bbec_guid"), // Blackbaud GUID
  role: text("role").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const interactions = pgTable("interactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
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
  userId: integer("user_id").notNull(),
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

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const insertInteractionSchema = createInsertSchema(interactions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  actualDate: z.union([z.date(), z.string().transform((str) => new Date(str))]),
  userId: z.number().optional(),
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

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Interaction = typeof interactions.$inferSelect;
export type InsertInteraction = z.infer<typeof insertInteractionSchema>;
export type AffinityTag = typeof affinityTags.$inferSelect;
export type InsertAffinityTag = z.infer<typeof insertAffinityTagSchema>;
export type VoiceRecording = typeof voiceRecordings.$inferSelect;
export type InsertVoiceRecording = z.infer<typeof insertVoiceRecordingSchema>;
export type AffinityTagSettings = typeof affinityTagSettings.$inferSelect;
export type InsertAffinityTagSettings = z.infer<typeof insertAffinityTagSettingsSchema>;

export interface ExtractedInteractionInfo {
  summary: string;
  category: string;
  subcategory: string;
  professionalInterests: string[];
  personalInterests: string[];
  philanthropicPriorities: string[];
  keyPoints: string[];
  suggestedAffinityTags: string[];
  prospectName?: string;
  contactLevel: string;
}