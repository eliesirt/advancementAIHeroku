# Blackbaud CRM Voice Interaction System

## Overview

This is a full-stack React application with Express backend designed for voice-enabled interaction management with Blackbaud CRM. The system allows users to record voice interactions, process them with AI to extract key information, and submit them to the Blackbaud CRM system via SOAP API integration.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript
- **Build Tool**: Vite for development and production builds
- **UI Framework**: Radix UI components with Tailwind CSS styling
- **State Management**: React Query (@tanstack/react-query) for server state
- **Routing**: Wouter for client-side routing
- **Form Management**: React Hook Form with Zod validation

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Database**: PostgreSQL with Drizzle ORM
- **Database Provider**: Neon Database (@neondatabase/serverless)
- **Authentication**: Session-based with connect-pg-simple
- **API Style**: REST endpoints with JSON responses

## Key Components

### Voice Recording System
- **Browser APIs**: WebRTC MediaRecorder for audio capture
- **Speech Recognition**: WebKit Speech Recognition for real-time transcription
- **Audio Processing**: Base64 encoding for audio data transmission
- **AI Integration**: OpenAI Whisper API for audio transcription

### AI Processing Pipeline
- **Transcription**: OpenAI Whisper for audio-to-text conversion
- **Information Extraction**: GPT-4 for structured data extraction from transcripts
- **Affinity Matching**: Fuzzy matching system using Fuse.js for tag suggestions
- **Content Enhancement**: AI-powered comment enhancement and summarization

### CRM Integration
- **Protocol**: SOAP API integration with Blackbaud CRM
- **Authentication**: Basic Auth with environment-stored credentials
- **Data Mapping**: Structured interaction data mapping to BBEC format
- **Constituent Search**: Real-time constituent lookup by name or BUID

### Mobile-First Design
- **Responsive UI**: Mobile-optimized interface with touch-friendly controls
- **Progressive Web App**: Offline capability considerations
- **Navigation**: Bottom navigation bar for mobile UX
- **Driving Mode**: Hands-free voice-controlled interface

## Data Flow

1. **Voice Input**: User records voice interaction through browser MediaRecorder
2. **Real-time Transcription**: Speech Recognition API provides live transcript
3. **AI Processing**: Recorded audio sent to OpenAI for transcription and analysis
4. **Data Extraction**: GPT-4 extracts structured information (names, categories, interests)
5. **Affinity Matching**: System matches extracted interests to predefined affinity tags
6. **Form Population**: Extracted data populates interaction form
7. **Validation**: SOP compliance validation before submission
8. **CRM Submission**: Data formatted and submitted to Blackbaud via SOAP API
9. **Status Tracking**: Interaction status tracked in local database

## External Dependencies

### Core Services
- **OpenAI API**: Audio transcription and text processing
- **Blackbaud CRM**: Target system for interaction data
- **Neon Database**: PostgreSQL hosting service

### Key Libraries
- **Database**: Drizzle ORM with PostgreSQL driver
- **AI Integration**: OpenAI SDK
- **SOAP Client**: Custom SOAP client for Blackbaud API
- **Voice Processing**: Browser Web APIs (MediaRecorder, Speech Recognition)
- **Fuzzy Matching**: Fuse.js for affinity tag matching
- **Form Validation**: Zod schema validation

### UI Components
- **Radix UI**: Accessible component primitives
- **Tailwind CSS**: Utility-first CSS framework
- **Lucide React**: Icon library
- **React Hook Form**: Form state management

## Deployment Strategy

### Development
- **Dev Server**: Vite development server with HMR
- **Database**: Neon database connection
- **Environment**: Local development with environment variables

### Production Build
- **Frontend**: Vite build output to `dist/public`
- **Backend**: esbuild compilation to `dist/index.js`
- **Static Assets**: Served from build directory
- **Database**: Production PostgreSQL connection

### Environment Configuration
- **Database**: `DATABASE_URL` for Neon connection
- **OpenAI**: `OPENAI_API_KEY` for AI services
- **Blackbaud**: `BLACKBAUD_API_AUTHENTICATION` for CRM integration
- **Session**: Secure session configuration for authentication

### Database Schema
- **Users**: User profiles with BUID and BBEC GUID mapping
- **Interactions**: Core interaction data with AI-extracted information
- **Affinity Tags**: Configurable interest/preference tags
- **Voice Recordings**: Audio data storage with transcripts
- **Settings**: User and system configuration options

The system follows a mobile-first, voice-enabled design philosophy with strong integration to Blackbaud CRM while maintaining local data persistence and offline capabilities.

## Recent Changes

### August 21, 2025 - Application Launcher Groupings & Voice Recording Fix
- **Implemented Application Groupings**: Added organized sections to the launcher page for better user experience
- **Applications Section**: Groups primary AI tools (interactionAI, portfolioAI, itineraryAI) under "Applications" with description "AI-powered advancement tools for fundraising excellence"
- **Configuration Section**: Groups system tools (Settings, User Management) under "Configuration" with description "System settings and user management tools"
- **Fixed Production Database**: Resolved sortOrder inconsistencies between development and production databases using direct SQL updates
- **Enhanced User Interface**: Improved launcher layout with clear section headers and better visual organization
- **Voice Recording Bug Fix**: Resolved critical Node.js compatibility issue where browser File API was causing transcription failures in production
- **Enhanced Error Handling**: Added comprehensive error messages and fallback handling for voice recording transcription issues
- **OpenAI Integration Fix**: Corrected audio transcription pipeline to use proper Node.js-compatible functions instead of browser APIs

### August 11, 2025 - Admin User Impersonation System
- **Complete Impersonation Framework**: Built comprehensive admin impersonation system allowing administrators to run as any non-admin user
- **Security Safeguards**: Admins cannot impersonate other administrators; only non-admin users can be impersonated
- **Impersonation Banner**: Added system-wide banner that appears on all pages during impersonation, showing both admin and target user
- **Easy Exit Mechanism**: Administrators can instantly return to admin account from any page during impersonation
- **Session Management**: Secure session-based impersonation tracking with proper cleanup and restoration
- **Cache Invalidation Fix**: Resolved permission caching issue where application permissions weren't updating in real-time during impersonation
- **Database Query Optimization**: Improved getUserApplications filtering to properly respect role-based permissions

### August 8, 2025 - Application Suite Transformation & AdvancementAI Branding
- **Transformed to Multi-App Suite**: Converted single application into comprehensive application suite with launcher
- **Implemented Authentication System**: Added Replit Auth with OpenID Connect for secure user management
- **Role-Based Access Control**: Created roles (Administrator, User) with dynamic application permissions
- **Application Launcher**: New branded "AdvancementAI" launcher page with BU-inspired design (white/#CC0000 color scheme)
- **Database Schema Updates**: Added roles, applications, userRoles, and roleApplications tables for RBAC
- **Navigation System**: Added "Back to Apps" buttons to all applications for seamless navigation
- **Administrator Privileges**: Granted elsirt@gmail.com full administrator access to manage the application suite
- **Branding Update**: Changed from "Application Suite" to "AdvancementAI - Boston University Advancement Technology Suite"

## Recent Changes

### July 30, 2025 - Added Configurable Affinity Tag Matching
- **Added matching threshold slider**: Configurable confidence threshold (5%-95%) in Settings tab
- **Database schema enhancement**: Added matchingThreshold field to affinityTagSettings table
- **Updated affinity matcher**: Modified AffinityMatcher class to accept configurable threshold parameter
- **Backend integration**: Updated all createAffinityMatcher calls to use stored threshold setting
- **User-friendly interface**: Added slider with helpful labels and usage tips for adjusting matching strictness

### July 30, 2025 - Removed History Tab
- **Removed History tab**: Completely removed History tab from bottom navigation as requested
- **Updated navigation layout**: Changed from 3-column to 2-column grid (Home and Settings only)
- **Cleaned up routing**: Removed history route and related handlers from App.tsx
- **Updated voice commands**: Removed "show history" voice commands from driving mode
- **Simplified navigation**: Streamlined user interface to focus on core interaction functionality

### August 6, 2025 - AI Prompt Customization System
- **Added customizable AI prompts**: Users can now customize the "Advancement Office Synopsis" generation prompts in Settings
- **Database schema enhancement**: New aiPromptSettings table with user-specific prompt templates and versioning
- **Full-stack implementation**: Complete CRUD operations with GET/POST API endpoints for prompt management
- **Updated OpenAI integration**: Modified generateInteractionSynopsis to use custom prompts with template variable substitution
- **Comprehensive UI interface**: Added "AI Prompt Customization" section in Settings with template editor, variable reference, and reset functionality
- **Template variable system**: Supports {{transcript}}, {{summary}}, {{category}}, and other dynamic content substitution
- **User-personalized AI analysis**: Each user can now tailor AI analysis criteria to their specific needs and preferences

### July 16, 2025 - Enhanced Affinity Tag Matching
- **Fixed critical affinity matching issue**: "Friends of BU Men's Ice Hockey" now correctly matches "Men's Hockey" affinity tag
- **Improved fuzzy matching algorithm**: Lowered threshold from 0.4 to 0.25 for better coverage
- **Added preprocessing logic**: Handles common prefixes like "Friends of", "Support for", "BU", "Boston University"
- **Enhanced sport-specific matching**: "ice hockey" variations now properly match hockey-related affinity tags
- **Added comprehensive quality assessment**: AI now provides 3+ specific improvement recommendations
- **Database schema enhancement**: Added qualityRecommendations field to store actionable suggestions