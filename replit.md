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

### July 16, 2025 - Enhanced Affinity Tag Matching
- **Fixed critical affinity matching issue**: "Friends of BU Men's Ice Hockey" now correctly matches "Men's Hockey" affinity tag
- **Improved fuzzy matching algorithm**: Lowered threshold from 0.4 to 0.25 for better coverage
- **Added preprocessing logic**: Handles common prefixes like "Friends of", "Support for", "BU", "Boston University"
- **Enhanced sport-specific matching**: "ice hockey" variations now properly match hockey-related affinity tags
- **Added comprehensive quality assessment**: AI now provides 3+ specific improvement recommendations
- **Database schema enhancement**: Added qualityRecommendations field to store actionable suggestions