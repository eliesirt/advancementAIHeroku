import { storage } from "./storage";

export async function seedInitialData() {
  try {
    console.log("Seeding initial data...");

    // Create default roles
    const roles = await storage.getRoles();
    
    if (roles.length === 0) {
      const adminRole = await storage.createRole({
        name: "Administrator",
        description: "Full system access with all permissions",
        isSystemRole: true,
      });

      const userRole = await storage.createRole({
        name: "User",
        description: "Standard user with basic access",
        isSystemRole: true,
      });

      console.log("Created default roles:", { adminRole: adminRole.id, userRole: userRole.id });
    }

    // Create default applications
    const applications = await storage.getApplications();
    
    if (applications.length === 0) {
      const interactionApp = await storage.createApplication({
        name: "interaction-manager",
        displayName: "interactionAI",
        description: "Manage prospect interactions and CRM data",
        route: "/apps/interactions",
        icon: "users",
        color: "blue",
        isActive: true,
        sortOrder: 1,
      });

      const settingsApp = await storage.createApplication({
        name: "settings",
        displayName: "Settings",
        description: "Application and user configuration",
        route: "/apps/settings",
        icon: "settings",
        color: "gray",
        isActive: true,
        sortOrder: 2,
      });

      const portfolioApp = await storage.createApplication({
        name: "portfolio-ai",
        displayName: "portfolioAI",
        description: "AI-powered prospect portfolio management for fundraisers",
        route: "/apps/portfolio",
        icon: "briefcase",
        color: "green",
        isActive: true,
        sortOrder: 3,
      });

      const itineraryApp = await storage.createApplication({
        name: "itinerary-ai",
        displayName: "itineraryAI",
        description: "AI-powered trip planning and prospect meeting optimization",
        route: "/apps/itinerary",
        icon: "map",
        color: "blue",
        isActive: true,
        sortOrder: 4,
      });

      const userManagementApp = await storage.createApplication({
        name: "user-management",
        displayName: "User Management",
        description: "Manage users, roles, and permissions",
        route: "/apps/user-management",
        icon: "users",
        color: "red",
        isActive: true,
        sortOrder: 5,
      });

      const pythonAIApp = await storage.createApplication({
        name: "pythonai",
        displayName: "pythonAI",
        description: "AI-enhanced Python script management, execution, and scheduling",
        route: "/apps/python-ai",
        icon: "Code",
        color: "bg-yellow-500",
        isActive: true,
        sortOrder: 6,
      });

      console.log("Created default applications:", { 
        interactionApp: interactionApp.id, 
        settingsApp: settingsApp.id,
        portfolioApp: portfolioApp.id,
        itineraryApp: itineraryApp.id,
        userManagementApp: userManagementApp.id,
        pythonAIApp: pythonAIApp.id
      });

      // Grant admin role access to all applications
      const adminRoles = await storage.getRoles();
      const adminRole = adminRoles.find(r => r.name === "Administrator");
      
      if (adminRole) {
        await storage.assignRoleApplication(adminRole.id, interactionApp.id, ["read", "write", "admin"]);
        await storage.assignRoleApplication(adminRole.id, settingsApp.id, ["read", "write", "admin"]);
        await storage.assignRoleApplication(adminRole.id, portfolioApp.id, ["read", "write", "admin"]);
        await storage.assignRoleApplication(adminRole.id, itineraryApp.id, ["read", "write", "admin"]);
        await storage.assignRoleApplication(adminRole.id, userManagementApp.id, ["read", "write", "admin"]);
        await storage.assignRoleApplication(adminRole.id, pythonAIApp.id, ["read", "write", "admin"]);
        console.log("Granted admin role access to all applications");
      }

      // Grant user role access to interaction and portfolio apps
      const userRole = adminRoles.find(r => r.name === "User");
      if (userRole) {
        await storage.assignRoleApplication(userRole.id, interactionApp.id, ["read", "write"]);
        await storage.assignRoleApplication(userRole.id, portfolioApp.id, ["read", "write"]);
        await storage.assignRoleApplication(userRole.id, itineraryApp.id, ["read", "write"]);
        await storage.assignRoleApplication(userRole.id, pythonAIApp.id, ["read", "write"]);
        console.log("Granted user role access to interaction, portfolio, itinerary, and pythonAI apps");
      }
    }

    // Ensure elsirt@gmail.com has admin role
    try {
      const adminUser = await storage.getUserByUsername("elsirt@gmail.com") || await storage.getUser("42195145");
      const adminRoles = await storage.getRoles();
      const adminRole = adminRoles.find(r => r.name === "Administrator");
      
      if (adminUser && adminRole) {
        // Check if user already has admin role
        const userRoles = await storage.getUserRoles(adminUser.id);
        const hasAdminRole = userRoles.some(role => role.id === adminRole.id);
        
        if (!hasAdminRole) {
          await storage.assignUserRole(adminUser.id, adminRole.id, "system");
          console.log(`Assigned Administrator role to user: ${adminUser.email || adminUser.id}`);
        } else {
          console.log(`User ${adminUser.email || adminUser.id} already has Administrator role`);
        }
      }
    } catch (error) {
      console.log("Note: Could not assign admin role to elsirt@gmail.com - user may not exist yet:", error);
    }

    // Update existing Interaction Manager application name if it exists
    try {
      const existingApps = await storage.getApplications();
      const interactionApp = existingApps.find(app => app.name === "interaction-manager");
      
      if (interactionApp && interactionApp.displayName === "Interaction Manager") {
        await storage.updateApplication(interactionApp.id, {
          displayName: "interactionAI"
        });
        console.log("Updated Interaction Manager display name to interactionAI");
      }
    } catch (error) {
      console.log("Note: Could not update application display name:", error);
    }

    // Seed sample prospect data for demonstration (development only)
    try {
      const existingProspects = await storage.getProspects();
      if (existingProspects.length === 0 && process.env.NODE_ENV !== 'production') {
        console.log("Seeding demo prospect data (development mode only)...");
        const sampleProspects = [
          {
            buid: "BUID001",
            bbecGuid: "BBEC-GUID-001",
            firstName: "John",
            lastName: "Smith",
            fullName: "John Smith",
            email: "john.smith@example.com",
            phone: "(617) 555-0101",
            prospectManagerId: "42195145", // elsirt@gmail.com's ID
            prospectRating: "Major",
            capacity: 500000,
            inclination: "High",
            stage: "Cultivation",
            occupation: "CEO",
            employer: "TechCorp Inc.",
            lifetimeGiving: 125000,
            currentYearGiving: 25000,
            priorYearGiving: 30000,
            largestGift: 50000,
            lastContactDate: new Date('2024-12-15'),
            totalInteractions: 18,
            affinityTags: ["Technology", "Alumni", "Leadership"],
            interests: ["Innovation", "Entrepreneurship", "Education"]
          },
          {
            buid: "BUID002", 
            bbecGuid: "BBEC-GUID-002",
            firstName: "Sarah",
            lastName: "Johnson",
            fullName: "Sarah Johnson",
            email: "sarah.johnson@example.com",
            phone: "(617) 555-0102",
            prospectManagerId: "42195145",
            prospectRating: "Principal",
            capacity: 250000,
            inclination: "Medium",
            stage: "Identification",
            occupation: "Managing Director",
            employer: "Financial Partners LLC",
            lifetimeGiving: 45000,
            currentYearGiving: 15000,
            priorYearGiving: 10000,
            largestGift: 20000,
            lastContactDate: new Date('2025-01-05'),
            totalInteractions: 12,
            affinityTags: ["Finance", "Women's Leadership"],
            interests: ["Economic Development", "Mentorship"]
          },
          {
            buid: "BUID003",
            bbecGuid: "BBEC-GUID-003", 
            firstName: "Michael",
            lastName: "Chen",
            fullName: "Michael Chen",
            email: "michael.chen@example.com",
            phone: "(617) 555-0103",
            prospectManagerId: "42195145",
            prospectRating: "Leadership",
            capacity: 1000000,
            inclination: "High",
            stage: "Stewardship",
            occupation: "Founder & Chairman",
            employer: "Chen Industries",
            spouse: "Lisa Chen",
            lifetimeGiving: 850000,
            currentYearGiving: 100000,
            priorYearGiving: 150000,
            largestGift: 250000,
            lastContactDate: new Date('2024-12-20'),
            totalInteractions: 35,
            affinityTags: ["Manufacturing", "Innovation", "Family Foundation"],
            interests: ["STEM Education", "Sustainability", "Research"]
          }
        ];

        for (const prospectData of sampleProspects) {
          await storage.createProspect(prospectData);
        }
        console.log("Created sample prospect data");
      } else if (process.env.NODE_ENV === 'production') {
        console.log("Skipping demo prospect seeding in production environment");
      }
    } catch (error) {
      console.log("Note: Could not create sample prospect data:", error);
    }

    console.log("Initial data seeding completed successfully");
  } catch (error) {
    console.error("Error seeding initial data:", error);
    throw error;
  }
}