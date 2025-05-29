import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const interactions = pgTable("interactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  prospectName: text("prospect_name").notNull(),
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

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const insertInteractionSchema = createInsertSchema(interactions).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAffinityTagSchema = createInsertSchema(affinityTags).omit({
  id: true,
  lastSynced: true,
});

export const insertVoiceRecordingSchema = createInsertSchema(voiceRecordings).omit({
  id: true,
  createdAt: true,
});

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Interaction = typeof interactions.$inferSelect;
export type InsertInteraction = z.infer<typeof insertInteractionSchema>;
export type AffinityTag = typeof affinityTags.$inferSelect;
export type InsertAffinityTag = z.infer<typeof insertAffinityTagSchema>;
export type VoiceRecording = typeof voiceRecordings.$inferSelect;
export type InsertVoiceRecording = z.infer<typeof insertVoiceRecordingSchema>;
