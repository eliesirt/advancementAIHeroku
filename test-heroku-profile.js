// Quick test script to check what's happening with Heroku profile updates
// Run with: node test-heroku-profile.js

const testProfileUpdate = () => {
  console.log("=== HEROKU PROFILE UPDATE TEST ===");
  
  // Simulate the data being sent from the form
  const formData = {
    firstName: "Elly",
    lastName: "Sirotta", 
    email: "elsirt@gmail.com",
    buid: "U12345678",
    bbecGuid: "34e0c896-76b2-4041-b035-6591356ca1ad",
    bbecUsername: "BBECAPI30656d",
    bbecPassword: "testpassword123"
  };
  
  console.log("Form data being sent:", {
    ...formData,
    bbecPassword: formData.bbecPassword ? "[HIDDEN]" : undefined
  });
  
  // Simulate the update data preparation from routes.ts
  const updateData = {
    firstName: formData.firstName.trim(),
    lastName: formData.lastName.trim(),
    email: formData.email.trim(),
    buid: formData.buid.trim()
  };

  if (formData.bbecGuid && formData.bbecGuid.trim()) {
    updateData.bbecGuid = formData.bbecGuid.trim();
  }

  if (formData.bbecUsername && formData.bbecUsername.trim()) {
    updateData.bbecUsername = formData.bbecUsername.trim();
  }

  if (formData.bbecPassword && formData.bbecPassword.trim()) {
    updateData.bbecPassword = formData.bbecPassword.trim();
  }

  console.log("Final update data:", {
    ...updateData,
    bbecPassword: updateData.bbecPassword ? "[HIDDEN]" : undefined
  });
  
  console.log("Fields that should be saved:");
  console.log("- bbecUsername present:", !!updateData.bbecUsername);
  console.log("- bbecPassword present:", !!updateData.bbecPassword);
  console.log("- bbecGuid present:", !!updateData.bbecGuid);
};

testProfileUpdate();