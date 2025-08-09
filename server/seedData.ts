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

      const userManagementApp = await storage.createApplication({
        name: "user-management",
        displayName: "User Management",
        description: "Manage users, roles, and permissions",
        route: "/apps/user-management",
        icon: "users",
        color: "red",
        isActive: true,
        sortOrder: 3,
      });

      console.log("Created default applications:", { 
        interactionApp: interactionApp.id, 
        settingsApp: settingsApp.id,
        userManagementApp: userManagementApp.id
      });

      // Grant admin role access to all applications
      const adminRoles = await storage.getRoles();
      const adminRole = adminRoles.find(r => r.name === "Administrator");
      
      if (adminRole) {
        await storage.assignRoleApplication(adminRole.id, interactionApp.id, ["read", "write", "admin"]);
        await storage.assignRoleApplication(adminRole.id, settingsApp.id, ["read", "write", "admin"]);
        await storage.assignRoleApplication(adminRole.id, userManagementApp.id, ["read", "write", "admin"]);
        console.log("Granted admin role access to all applications");
      }

      // Grant user role access to interaction app
      const userRole = adminRoles.find(r => r.name === "User");
      if (userRole) {
        await storage.assignRoleApplication(userRole.id, interactionApp.id, ["read", "write"]);
        console.log("Granted user role access to interaction app");
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

    console.log("Initial data seeding completed successfully");
  } catch (error) {
    console.error("Error seeding initial data:", error);
    throw error;
  }
}