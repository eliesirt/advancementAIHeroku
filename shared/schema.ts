import { sql } from 'drizzle-orm';
import { pgTable, text, serial, integer, boolean, timestamp, jsonb, varchar, index, primaryKey, uniqueIndex } from "drizzle-orm/pg-core";
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
  bbecUsername: text("bbec_username"), // BBEC username for API authentication
  bbecPassword: text("bbec_password"), // BBEC password for API authentication (encrypted)
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

// BBEC Interactions table for storing interaction data fetched from BBEC API
export const bbecInteractions = pgTable("bbec_interactions", {
  id: serial("id").primaryKey(),
  constituentId: text("constituent_id").notNull(), // GUID from BBEC
  name: text("name").notNull(), // Full name (first and last together)
  lastName: text("last_name").notNull(),
  lookupId: text("lookup_id").notNull(), // User-friendly ID (U, Z, or 8 prefix)
  interactionLookupId: text("interaction_lookup_id").notNull(), // User-friendly unique ID for interaction
  interactionId: text("interaction_id").notNull(), // GUID unique ID for interaction
  summary: text("summary"), // Short description
  comment: text("comment"), // Long verbose detailed description
  date: timestamp("date").notNull(), // Date of interaction
  contactMethod: text("contact_method"), // Type of meeting (in-person, zoom, email, etc.)
  prospectManagerId: text("prospect_manager_id").notNull(), // GUID of prospect manager
  lastSynced: timestamp("last_synced").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  // Unique constraint for upserts on constituent + interaction combination
  uniqueConstituentInteraction: uniqueIndex("bbec_interactions_constituent_interaction_uidx").on(table.constituentId, table.interactionId),
  // Additional indexes for efficient lookups
  prospectManagerIdx: index("bbec_interactions_prospect_manager_idx").on(table.prospectManagerId),
  dateIdx: index("bbec_interactions_date_idx").on(table.date),
}));

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

// Python Scripts table for pythonAI application
export const pythonScripts = pgTable("python_scripts", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  tags: text("tags").array().default([]),
  ownerId: varchar("owner_id").notNull().references(() => users.id),
  content: text("content").notNull(), // Full Python script content
  metadata: jsonb("metadata"), // YAML front-matter parsed as JSON
  requirements: text("requirements").array().default([]), // pip requirements
  version: integer("version").default(1),
  isActive: boolean("is_active").default(true),
  lastRunAt: timestamp("last_run_at"),
  status: text("status").default("draft"), // draft, active, deprecated
  gitHash: text("git_hash"), // Git commit hash for version control
  gitBranch: text("git_branch").default("main"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Script versions for version control
export const scriptVersions = pgTable("script_versions", {
  id: serial("id").primaryKey(),
  scriptId: integer("script_id").notNull().references(() => pythonScripts.id, { onDelete: "cascade" }),
  version: integer("version").notNull(),
  content: text("content").notNull(),
  changeDescription: text("change_description"),
  createdBy: varchar("created_by").notNull().references(() => users.id),
  gitHash: text("git_hash"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  uniqueScriptVersion: index("unique_script_version_idx").on(table.scriptId, table.version),
}));

// Script execution history
export const scriptExecutions = pgTable("script_executions", {
  id: serial("id").primaryKey(),
  scriptId: integer("script_id").notNull().references(() => pythonScripts.id, { onDelete: "cascade" }),
  scheduleId: integer("schedule_id"),
  triggeredBy: varchar("triggered_by").notNull().references(() => users.id),
  status: text("status").notNull().default("queued"), // queued, running, completed, failed, timeout
  inputs: jsonb("inputs"), // Input parameters passed to script
  stdout: text("stdout"),
  stderr: text("stderr"),
  exitCode: integer("exit_code"),
  duration: integer("duration"), // milliseconds
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  environmentSnapshot: jsonb("environment_snapshot"), // Packages and versions used
  artifacts: jsonb("artifacts"), // Output files, results, etc.
  resourceUsage: jsonb("resource_usage"), // CPU, memory, network stats
  isScheduled: boolean("is_scheduled").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Script scheduling
export const scriptSchedules = pgTable("script_schedules", {
  id: serial("id").primaryKey(),
  scriptId: integer("script_id").notNull().references(() => pythonScripts.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  cronExpression: text("cron_expression").notNull(),
  timezone: text("timezone").default("UTC"),
  isActive: boolean("is_active").default(true),
  inputs: jsonb("inputs"), // Default inputs for scheduled runs
  maxConcurrentRuns: integer("max_concurrent_runs").default(1),
  timeoutSeconds: integer("timeout_seconds").default(300), // 5 minutes default
  createdBy: varchar("created_by").notNull().references(() => users.id),
  lastRunAt: timestamp("last_run_at"),
  nextRunAt: timestamp("next_run_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// AI QC results for scripts
export const scriptQcResults = pgTable("script_qc_results", {
  id: serial("id").primaryKey(),
  scriptId: integer("script_id").notNull().references(() => pythonScripts.id, { onDelete: "cascade" }),
  version: integer("version").notNull(),
  lintingResults: jsonb("linting_results"), // PEP8, style issues
  securityIssues: jsonb("security_issues"), // Security vulnerabilities
  suggestions: jsonb("suggestions"), // Improvement recommendations
  generatedTests: text("generated_tests"), // pytest test code
  generatedDocstrings: text("generated_docstrings"), // Enhanced docstrings
  qualityScore: integer("quality_score"), // 0-100 overall quality
  createdBy: varchar("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Git repository configuration for version control
export const gitRepositories = pgTable("git_repositories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  provider: text("provider").notNull(), // github, gitlab, azure
  repositoryUrl: text("repository_url").notNull(),
  branch: text("branch").default("main"),
  scriptPath: text("script_path").default("scripts/"), // Path within repo for scripts
  webhookSecret: text("webhook_secret"), // For webhook validation
  isActive: boolean("is_active").default(true),
  lastSyncAt: timestamp("last_sync_at"),
  createdBy: varchar("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Script permissions for RBAC
export const scriptPermissions = pgTable("script_permissions", {
  id: serial("id").primaryKey(),
  scriptId: integer("script_id").notNull().references(() => pythonScripts.id, { onDelete: "cascade" }),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }),
  roleId: integer("role_id").references(() => roles.id, { onDelete: "cascade" }),
  permissions: text("permissions").array().notNull(), // read, execute, edit, schedule, admin
  grantedBy: varchar("granted_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  // Either user or role must be specified, but not both
  userOrRoleCheck: index("user_or_role_check_idx").on(table.scriptId),
}));

// Prospects table for portfolio management
export const prospects = pgTable("prospects", {
  id: serial("id").primaryKey(),
  buid: text("buid").unique().notNull(), // Blackbaud Unique ID
  bbecGuid: text("bbec_guid").unique(), // Blackbaud GUID
  constituentGuid: text("constituent_guid").unique(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  fullName: text("full_name").notNull(),
  email: text("email"),
  phone: text("phone"),
  address: jsonb("address"), // Full address structure
  preferredName: text("preferred_name"),
  
  // Prospect management fields
  prospectManagerId: varchar("prospect_manager_id").references(() => users.id), // Assigned prospect manager
  primaryProspectManagerId: varchar("primary_prospect_manager_id").references(() => users.id), // Primary manager
  prospectRating: text("prospect_rating"), // Major, Principal, Leadership, etc.
  capacity: integer("capacity"), // Estimated giving capacity
  inclination: text("inclination"), // High, Medium, Low
  stage: text("stage").notNull().default('Identification'), // Cultivation stage
  
  // Personal information
  birthDate: timestamp("birth_date"),
  spouse: text("spouse"),
  occupation: text("occupation"),
  employer: text("employer"),
  linkedInUrl: text("linkedin_url"),
  bio: text("bio"),
  
  // Giving history
  lifetimeGiving: integer("lifetime_giving").default(0),
  currentYearGiving: integer("current_year_giving").default(0),
  priorYearGiving: integer("prior_year_giving").default(0),
  largestGift: integer("largest_gift").default(0),
  firstGiftDate: timestamp("first_gift_date"),
  lastGiftDate: timestamp("last_gift_date"),
  
  // AI-generated fields
  aiSummary: text("ai_summary"), // AI-generated prospect summary
  aiNextActions: text("ai_next_actions"), // AI-suggested next steps
  affinityTags: text("affinity_tags").array().default([]),
  interests: text("interests").array().default([]),
  
  // Engagement tracking
  lastContactDate: timestamp("last_contact_date"),
  nextContactDate: timestamp("next_contact_date"),
  totalInteractions: integer("total_interactions").default(0),
  
  // System fields
  isActive: boolean("is_active").default(true),
  lastSyncedAt: timestamp("last_synced_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Prospect relationships (spouse, family, etc.)
export const prospectRelationships = pgTable("prospect_relationships", {
  id: serial("id").primaryKey(),
  prospectId: integer("prospect_id").notNull().references(() => prospects.id, { onDelete: "cascade" }),
  relatedProspectId: integer("related_prospect_id").references(() => prospects.id),
  relationshipType: text("relationship_type").notNull(), // Spouse, Child, Parent, Sibling, etc.
  relationshipName: text("relationship_name"), // For non-prospect relationships
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Prospect event attendance
export const prospectEvents = pgTable("prospect_events", {
  id: serial("id").primaryKey(),
  prospectId: integer("prospect_id").notNull().references(() => prospects.id, { onDelete: "cascade" }),
  eventName: text("event_name").notNull(),
  eventDate: timestamp("event_date").notNull(),
  eventType: text("event_type"), // Reception, Gala, Lecture, etc.
  attendanceStatus: text("attendance_status").notNull().default('Attended'), // Attended, Registered, No-Show
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Prospect badges/achievements
export const prospectBadges = pgTable("prospect_badges", {
  id: serial("id").primaryKey(),
  prospectId: integer("prospect_id").notNull().references(() => prospects.id, { onDelete: "cascade" }),
  badgeType: text("badge_type").notNull(), // donor_milestone, event_attendance, engagement, etc.
  badgeName: text("badge_name").notNull(),
  badgeDescription: text("badge_description"),
  badgeIcon: text("badge_icon"), // Icon class or emoji
  badgeColor: text("badge_color").default('blue'),
  achievedAt: timestamp("achieved_at").defaultNow().notNull(),
  isVisible: boolean("is_visible").default(true),
});

// Trip itineraries for travel planning
export const itineraries = pgTable("itineraries", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  description: text("description"),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  homeAddress: jsonb("home_address"), // Starting point address
  travelMode: text("travel_mode").notNull().default('driving'), // driving, flying, mixed
  status: text("status").notNull().default('planning'), // planning, confirmed, in_progress, completed
  totalDistance: integer("total_distance"), // in miles
  totalDuration: integer("total_duration"), // in minutes
  estimatedCost: integer("estimated_cost"), // in cents
  aiOptimizations: text("ai_optimizations"), // AI-generated optimization suggestions
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Individual meetings within an itinerary
export const itineraryMeetings = pgTable("itinerary_meetings", {
  id: serial("id").primaryKey(),
  itineraryId: integer("itinerary_id").notNull().references(() => itineraries.id, { onDelete: "cascade" }),
  prospectId: integer("prospect_id").notNull().references(() => prospects.id),
  scheduledDate: timestamp("scheduled_date").notNull(),
  scheduledTime: text("scheduled_time"), // HH:MM format
  duration: integer("duration").notNull().default(60), // minutes
  meetingType: text("meeting_type").notNull(), // visit, call, event, meal
  location: jsonb("location").notNull(), // Address object with coordinates
  notes: text("notes"),
  status: text("status").notNull().default('planned'), // planned, confirmed, cancelled, completed
  sortOrder: integer("sort_order").notNull(),
  travelTimeFromPrevious: integer("travel_time_from_previous"), // minutes
  distanceFromPrevious: integer("distance_from_previous"), // miles
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Travel segments between meetings
export const itineraryTravelSegments = pgTable("itinerary_travel_segments", {
  id: serial("id").primaryKey(),
  itineraryId: integer("itinerary_id").notNull().references(() => itineraries.id, { onDelete: "cascade" }),
  fromMeetingId: integer("from_meeting_id").references(() => itineraryMeetings.id),
  toMeetingId: integer("to_meeting_id").references(() => itineraryMeetings.id),
  fromLocation: jsonb("from_location").notNull(),
  toLocation: jsonb("to_location").notNull(),
  transportMode: text("transport_mode").notNull().default('driving'), // driving, flying, walking, uber
  distance: integer("distance"), // miles
  duration: integer("duration"), // minutes
  directions: jsonb("directions"), // Step-by-step directions
  route: jsonb("route"), // Map route coordinates
  cost: integer("cost"), // estimated cost in cents
  notes: text("notes"),
  sortOrder: integer("sort_order").notNull(),
});

// AI Job Queue for handling long-running operations
export const aiJobs = pgTable("ai_jobs", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  type: text("type").notNull(), // 'script_generation', 'code_analysis', 'code_commenting'
  status: text("status").notNull().default('pending'), // 'pending', 'processing', 'completed', 'failed'
  input: jsonb("input").notNull(), // Job input parameters
  result: jsonb("result"), // Job result data
  error: text("error"), // Error message if failed
  progress: integer("progress").default(0), // 0-100 percentage
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// System settings for application-wide configuration
export const systemSettings = pgTable("system_settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(), // Setting identifier like 'ai_model_preference'
  value: jsonb("value").notNull(), // Setting value (can be string, object, array, etc.)
  description: text("description"), // Human-readable description
  category: text("category").default("general"), // 'ai', 'integrations', 'ui', etc.
  isUserSpecific: boolean("is_user_specific").default(false), // If true, users can have individual values
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// User-specific setting overrides
export const userSettings = pgTable("user_settings", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  settingKey: text("setting_key").notNull(), // References systemSettings.key
  value: jsonb("value").notNull(), // User's override value
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// SSO configuration for multiple identity providers
export const ssoConfigurations = pgTable("sso_configurations", {
  id: serial("id").primaryKey(),
  tenantId: text("tenant_id").notNull().unique(), // Organization identifier
  provider: text("provider").notNull(), // 'entra', 'saml', 'okta', etc.
  displayName: text("display_name").notNull(),
  clientId: text("client_id").notNull(),
  clientSecret: text("client_secret").notNull(), // Encrypted in production
  issuerUrl: text("issuer_url"), // For OIDC providers
  metadataUrl: text("metadata_url"), // For SAML providers
  certificateData: text("certificate_data"), // For SAML certificate validation
  domainHints: text("domain_hints").array().default([]), // Email domains that should use this provider
  isActive: boolean("is_active").default(true),
  autoProvisionUsers: boolean("auto_provision_users").default(true),
  defaultRole: text("default_role").default("User"), // Role assigned to new SSO users
  roleClaimPath: text("role_claim_path"), // JSON path to extract roles from claims
  groupClaimPath: text("group_claim_path"), // JSON path to extract groups from claims
  roleMappings: jsonb("role_mappings"), // Map SSO roles/groups to internal roles
  additionalScopes: text("additional_scopes").array().default([]), // Extra OIDC scopes
  loginHint: text("login_hint"), // Hint text for login button
  buttonColor: text("button_color").default("#0078d4"), // Custom button color
  logoUrl: text("logo_url"), // Organization logo for login button
  createdBy: varchar("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// SSO user sessions for tracking which provider authenticated the user
export const ssoSessions = pgTable("sso_sessions", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tenantId: text("tenant_id").notNull(),
  provider: text("provider").notNull(),
  providerUserId: text("provider_user_id").notNull(), // User ID from the SSO provider
  sessionData: jsonb("session_data"), // Store claims, tokens, etc.
  lastUsed: timestamp("last_used").defaultNow().notNull(),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  userTenantIndex: index("sso_sessions_user_tenant_idx").on(table.userId, table.tenantId),
}));

// Define relations
export const usersRelations = relations(users, ({ many }) => ({
  userRoles: many(userRoles),
  interactions: many(interactions),
  voiceRecordings: many(voiceRecordings),
  aiPromptSettings: many(aiPromptSettings),
  ssoSessions: many(ssoSessions),
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

export const prospectsRelations = relations(prospects, ({ one, many }) => ({
  prospectManager: one(users, {
    fields: [prospects.prospectManagerId],
    references: [users.id],
  }),
  primaryProspectManager: one(users, {
    fields: [prospects.primaryProspectManagerId],
    references: [users.id],
  }),
  relationships: many(prospectRelationships),
  events: many(prospectEvents),
  badges: many(prospectBadges),
}));

export const prospectRelationshipsRelations = relations(prospectRelationships, ({ one }) => ({
  prospect: one(prospects, {
    fields: [prospectRelationships.prospectId],
    references: [prospects.id],
  }),
  relatedProspect: one(prospects, {
    fields: [prospectRelationships.relatedProspectId],
    references: [prospects.id],
  }),
}));

export const prospectEventsRelations = relations(prospectEvents, ({ one }) => ({
  prospect: one(prospects, {
    fields: [prospectEvents.prospectId],
    references: [prospects.id],
  }),
}));

export const prospectBadgesRelations = relations(prospectBadges, ({ one }) => ({
  prospect: one(prospects, {
    fields: [prospectBadges.prospectId],
    references: [prospects.id],
  }),
}));

export const itinerariesRelations = relations(itineraries, ({ one, many }) => ({
  user: one(users, {
    fields: [itineraries.userId],
    references: [users.id],
  }),
  meetings: many(itineraryMeetings),
  travelSegments: many(itineraryTravelSegments),
}));

export const itineraryMeetingsRelations = relations(itineraryMeetings, ({ one }) => ({
  itinerary: one(itineraries, {
    fields: [itineraryMeetings.itineraryId],
    references: [itineraries.id],
  }),
  prospect: one(prospects, {
    fields: [itineraryMeetings.prospectId],
    references: [prospects.id],
  }),
}));

export const itineraryTravelSegmentsRelations = relations(itineraryTravelSegments, ({ one }) => ({
  itinerary: one(itineraries, {
    fields: [itineraryTravelSegments.itineraryId],
    references: [itineraries.id],
  }),
  fromMeeting: one(itineraryMeetings, {
    fields: [itineraryTravelSegments.fromMeetingId],
    references: [itineraryMeetings.id],
  }),
  toMeeting: one(itineraryMeetings, {
    fields: [itineraryTravelSegments.toMeetingId],
    references: [itineraryMeetings.id],
  }),
}));

export const aiJobsRelations = relations(aiJobs, ({ one }) => ({
  user: one(users, {
    fields: [aiJobs.userId],
    references: [users.id],
  }),
}));

export const ssoConfigurationsRelations = relations(ssoConfigurations, ({ one }) => ({
  createdBy: one(users, {
    fields: [ssoConfigurations.createdBy],
    references: [users.id],
  }),
}));

export const ssoSessionsRelations = relations(ssoSessions, ({ one }) => ({
  user: one(users, {
    fields: [ssoSessions.userId],
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

export const insertBbecInteractionSchema = createInsertSchema(bbecInteractions).omit({
  id: true,
  lastSynced: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  date: z.union([z.date(), z.string().transform((str) => new Date(str))]),
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

// Python AI schemas
export const insertPythonScriptSchema = createInsertSchema(pythonScripts).omit({
  id: true,
  version: true,
  lastRunAt: true,
  createdAt: true,
  updatedAt: true,
});

export const insertScriptVersionSchema = createInsertSchema(scriptVersions).omit({
  id: true,
  createdAt: true,
});

export const insertScriptExecutionSchema = createInsertSchema(scriptExecutions).omit({
  id: true,
  startedAt: true,
  completedAt: true,
  createdAt: true,
});

export const insertScriptScheduleSchema = createInsertSchema(scriptSchedules).omit({
  id: true,
  lastRunAt: true,
  nextRunAt: true,
  createdAt: true,
  updatedAt: true,
});

export const insertScriptQcResultSchema = createInsertSchema(scriptQcResults).omit({
  id: true,
  createdAt: true,
});

export const insertGitRepositorySchema = createInsertSchema(gitRepositories).omit({
  id: true,
  lastSyncAt: true,
  createdAt: true,
  updatedAt: true,
});

export const insertScriptPermissionSchema = createInsertSchema(scriptPermissions).omit({
  id: true,
  createdAt: true,
});

export const insertProspectSchema = createInsertSchema(prospects).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProspectRelationshipSchema = createInsertSchema(prospectRelationships).omit({
  id: true,
  createdAt: true,
});

export const insertProspectEventSchema = createInsertSchema(prospectEvents).omit({
  id: true,
  createdAt: true,
});

export const insertProspectBadgeSchema = createInsertSchema(prospectBadges).omit({
  id: true,
  achievedAt: true,
});

export const insertItinerarySchema = createInsertSchema(itineraries).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  startDate: z.union([z.date(), z.string().transform((str) => new Date(str))]),
  endDate: z.union([z.date(), z.string().transform((str) => new Date(str))]),
});

export const insertItineraryMeetingSchema = createInsertSchema(itineraryMeetings).omit({
  id: true,
  createdAt: true,
}).extend({
  scheduledDate: z.union([z.date(), z.string().transform((str) => new Date(str))]),
});

export const insertItineraryTravelSegmentSchema = createInsertSchema(itineraryTravelSegments).omit({
  id: true,
});

export const insertAiJobSchema = createInsertSchema(aiJobs).omit({
  id: true,
  startedAt: true,
  completedAt: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSystemSettingSchema = createInsertSchema(systemSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUserSettingSchema = createInsertSchema(userSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// SSO Configuration schemas
export const insertSSOConfigurationSchema = createInsertSchema(ssoConfigurations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSSOSessionSchema = createInsertSchema(ssoSessions).omit({
  id: true,
  createdAt: true,
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
export type BbecInteraction = typeof bbecInteractions.$inferSelect;
export type InsertBbecInteraction = z.infer<typeof insertBbecInteractionSchema>;
export type AffinityTag = typeof affinityTags.$inferSelect;
export type InsertAffinityTag = z.infer<typeof insertAffinityTagSchema>;
export type VoiceRecording = typeof voiceRecordings.$inferSelect;
export type InsertVoiceRecording = z.infer<typeof insertVoiceRecordingSchema>;
export type AffinityTagSettings = typeof affinityTagSettings.$inferSelect;
export type InsertAffinityTagSettings = z.infer<typeof insertAffinityTagSettingsSchema>;
export type AiPromptSettings = typeof aiPromptSettings.$inferSelect;
export type InsertAiPromptSettings = z.infer<typeof insertAiPromptSettingsSchema>;

// Python AI types
export type InsertPythonScript = z.infer<typeof insertPythonScriptSchema>;
export type PythonScript = typeof pythonScripts.$inferSelect;
export type InsertScriptVersion = z.infer<typeof insertScriptVersionSchema>;
export type ScriptVersion = typeof scriptVersions.$inferSelect;
export type InsertScriptExecution = z.infer<typeof insertScriptExecutionSchema>;
export type ScriptExecution = typeof scriptExecutions.$inferSelect;
export type InsertScriptSchedule = z.infer<typeof insertScriptScheduleSchema>;
export type ScriptSchedule = typeof scriptSchedules.$inferSelect;
export type InsertScriptQcResult = z.infer<typeof insertScriptQcResultSchema>;
export type ScriptQcResult = typeof scriptQcResults.$inferSelect;
export type InsertGitRepository = z.infer<typeof insertGitRepositorySchema>;
export type GitRepository = typeof gitRepositories.$inferSelect;
export type InsertScriptPermission = z.infer<typeof insertScriptPermissionSchema>;
export type ScriptPermission = typeof scriptPermissions.$inferSelect;

// Extended types with relations for Python AI
export type PythonScriptWithVersions = PythonScript & {
  versions: ScriptVersion[];
  executions: ScriptExecution[];
  schedules: ScriptSchedule[];
  permissions: ScriptPermission[];
  owner: User;
};

export type ScriptExecutionWithScript = ScriptExecution & {
  script: PythonScript;
  schedule?: ScriptSchedule;
  triggeredByUser: User;
};

export type Prospect = typeof prospects.$inferSelect;
export type InsertProspect = z.infer<typeof insertProspectSchema>;
export type ProspectRelationship = typeof prospectRelationships.$inferSelect;
export type InsertProspectRelationship = z.infer<typeof insertProspectRelationshipSchema>;
export type ProspectEvent = typeof prospectEvents.$inferSelect;
export type InsertProspectEvent = z.infer<typeof insertProspectEventSchema>;
export type ProspectBadge = typeof prospectBadges.$inferSelect;
export type InsertProspectBadge = z.infer<typeof insertProspectBadgeSchema>;
export type Itinerary = typeof itineraries.$inferSelect;
export type InsertItinerary = z.infer<typeof insertItinerarySchema>;
export type ItineraryMeeting = typeof itineraryMeetings.$inferSelect;
export type InsertItineraryMeeting = z.infer<typeof insertItineraryMeetingSchema>;
export type ItineraryTravelSegment = typeof itineraryTravelSegments.$inferSelect;
export type InsertItineraryTravelSegment = z.infer<typeof insertItineraryTravelSegmentSchema>;
export type AiJob = typeof aiJobs.$inferSelect;
export type InsertAiJob = z.infer<typeof insertAiJobSchema>;

export type SystemSetting = typeof systemSettings.$inferSelect;
export type InsertSystemSetting = z.infer<typeof insertSystemSettingSchema>;
export type UserSetting = typeof userSettings.$inferSelect;
export type InsertUserSetting = z.infer<typeof insertUserSettingSchema>;

// SSO Configuration types
export type SSOConfiguration = typeof ssoConfigurations.$inferSelect;
export type InsertSSOConfiguration = z.infer<typeof insertSSOConfigurationSchema>;
export type SSOSession = typeof ssoSessions.$inferSelect;
export type InsertSSOSession = z.infer<typeof insertSSOSessionSchema>;

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
  qualityScore?: number;
  qualityRecommendations?: string[];
}

// Extended prospect types for UI
export interface ProspectWithDetails extends Prospect {
  prospectManager?: User;
  primaryProspectManager?: User;
  relationships?: (ProspectRelationship & { relatedProspect?: Prospect })[];
  events?: ProspectEvent[];
  badges?: ProspectBadge[];
  recentInteractions?: Interaction[];
}

export interface ProspectSummaryData {
  interactionHistory: {
    totalCount: number;
    lastTwoYears: Interaction[];
    lastContactDate?: Date;
    averageContactsPerMonth: number;
  };
  donorHistory: {
    lifetimeGiving: number;
    currentYearGiving: number;
    priorYearGiving: number;
    largestGift: number;
    firstGiftDate?: Date;
    lastGiftDate?: Date;
    totalGifts: number;
    averageGiftSize: number;
  };
  eventAttendance: {
    totalEvents: number;
    lastTwoYears: ProspectEvent[];
    favoriteEventTypes: string[];
    attendanceRate: number;
  };
  relationships: {
    spouse?: string;
    family: ProspectRelationship[];
    professionalConnections: ProspectRelationship[];
  };
  professional: {
    currentPosition?: string;
    employer?: string;
    linkedInUrl?: string;
    careerHighlights: string[];
    industryExpertise: string[];
  };
  engagement: {
    prospectRating: string;
    capacity: number;
    inclination: string;
    stage: string;
    affinityScore: number;
    engagementTrend: string;
  };
}