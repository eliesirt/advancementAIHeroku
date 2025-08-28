## Overview

This is a full-stack React application with an Express backend designed for voice-enabled interaction management with Blackbaud CRM. The system allows users to record voice interactions, process them with AI to extract key information, and submit them to the Blackbaud CRM system via SOAP API integration. It aims to provide a mobile-first, voice-enabled, and responsive solution for efficient data entry and management within the Blackbaud ecosystem, branded as "AdvancementAI - Boston University Advancement Technology Suite." The system has evolved into a multi-application suite, including Python script management capabilities, focusing on enhancing fundraising and advancement operations.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript
- **Build Tool**: Vite
- **UI Framework**: Radix UI with Tailwind CSS
- **State Management**: React Query
- **Routing**: Wouter
- **Form Management**: React Hook Form with Zod validation
- **Design Philosophy**: Mobile-first, responsive UI with touch-friendly controls and bottom navigation. PWA considerations for offline capability.

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Database**: PostgreSQL with Drizzle ORM (Neon Database provider)
- **Authentication**: Session-based with `connect-pg-simple` and Replit Auth with OpenID Connect.
- **API Style**: REST endpoints with JSON responses.
- **Access Control**: Role-Based Access Control (RBAC) with roles (Administrator, User) and dynamic application permissions. Includes admin impersonation functionality with security safeguards.

### Key Features & Technical Implementations
- **Voice Recording System**: Utilizes WebRTC MediaRecorder for audio capture, WebKit Speech Recognition for real-time transcription, and OpenAI Whisper API for audio transcription.
- **AI Processing Pipeline**: Integrates OpenAI Whisper for transcription and GPT-4 for structured data extraction, content enhancement, and summarization. Includes AI-powered quality assessment and customizable AI prompts for synopsis generation.
- **Affinity Matching**: Employs a fuzzy matching system (Fuse.js) for tag suggestions, with configurable matching thresholds and improved preprocessing logic for better accuracy.
- **CRM Integration**: Achieved via SOAP API with Blackbaud CRM, including basic authentication, structured data mapping to BBEC format, and real-time constituent lookup.
- **Data Flow**: Voice input -> Real-time Transcription -> AI Processing (Whisper, GPT-4) -> Data Extraction -> Affinity Matching -> Form Population -> Validation -> CRM Submission.
- **PythonAI Application**: Full-featured system for managing Python scripts, including database schema for script management (versions, executions, schedules, QC results) and full CRUD operations.
- **Application Suite & Launcher**: Transformed into a multi-application suite with an "AdvancementAI" launcher page, featuring organized groupings for primary AI tools and system configuration.

### Data Model Highlights
- **Users**: Profiles with BUID and BBEC GUID mapping, roles.
- **Interactions**: Core interaction data with AI-extracted information, quality assessments, and voice recordings.
- **Affinity Tags**: Configurable interest/preference tags with matching settings.
- **AI Prompt Settings**: User-specific customizable prompt templates for AI analysis.
- **Python Scripts**: Tables for scripts, versions, executions, schedules, QC results, git repositories, and permissions.

## External Dependencies

- **OpenAI API**: Used for audio transcription (Whisper) and text processing/information extraction (GPT-4).
- **Blackbaud CRM**: The target system for interaction data submission via SOAP API.
- **Neon Database**: PostgreSQL hosting service.
- **Replit Auth**: For OpenID Connect based authentication.
- **Google Places API**: For address autocomplete and details.
- **Drizzle ORM**: For PostgreSQL database interaction.
- **OpenAI SDK**: For integrating with OpenAI services.
- **Custom SOAP client**: Developed for Blackbaud API integration.
- **Browser Web APIs**: MediaRecorder and Speech Recognition for voice processing.
- **Fuse.js**: For fuzzy matching affinity tags.
- **Radix UI**: For accessible UI component primitives.
- **Tailwind CSS**: For utility-first CSS styling.
- **Lucide React**: Icon library.
- **React Hook Form**: For form state management.
- **Zod**: For schema validation.