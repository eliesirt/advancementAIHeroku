// Quick test script to debug voice processing on Heroku production
// This script tests if the API response format is different between dev/prod

const testVoiceProcessingFormats = async () => {
  console.log('=== Testing Voice Processing API Response Formats ===\n');
  
  // Test both development and production endpoints
  const endpoints = [
    { name: 'Replit Dev', url: 'http://localhost:5000/api/voice-recordings/process-direct' },
    { name: 'Heroku Prod', url: 'https://advancement-ai-b8abf01faf28.herokuapp.com/api/voice-recordings/process-direct' }
  ];
  
  const testData = {
    transcript: "This is a test transcript for John Smith regarding a donation discussion. We talked about his interest in supporting the engineering program.",
    audioData: "", 
    duration: 15
  };

  for (const endpoint of endpoints) {
    console.log(`\n--- Testing ${endpoint.name} ---`);
    
    try {
      const response = await fetch(endpoint.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Note: Add session cookies or auth headers as needed for production
        },
        body: JSON.stringify(testData)
      });

      console.log(`Status: ${response.status} ${response.statusText}`);
      
      if (response.ok) {
        const data = await response.json();
        
        console.log('Response Structure:');
        console.log('- Top level keys:', Object.keys(data));
        
        // Check for different response formats
        if (data.transcript) {
          console.log('✓ Direct format: data.transcript exists');
          console.log('✓ Direct format: data.extractedInfo exists:', !!data.extractedInfo);
          console.log('✓ Direct format: data.enhancedComments exists:', !!data.enhancedComments);
        }
        
        if (data.voiceRecording) {
          console.log('✓ Nested format: data.voiceRecording exists');
          console.log('  - voiceRecording keys:', Object.keys(data.voiceRecording));
        }
        
        if (data.result) {
          console.log('✓ Result format: data.result exists');
          console.log('  - result keys:', Object.keys(data.result));
        }
        
        // Sample the actual content
        const transcript = data.transcript || data.voiceRecording?.transcript || data.result?.transcript;
        const enhancedComments = data.enhancedComments || data.voiceRecording?.enhancedComments || data.result?.enhancedComments;
        
        console.log('Content Sample:');
        console.log('- Transcript length:', transcript?.length || 0);
        console.log('- Enhanced comments length:', enhancedComments?.length || 0);
        console.log('- Transcript sample:', transcript?.substring(0, 50) + '...');
        
      } else {
        const errorData = await response.text();
        console.log('❌ Error Response:', errorData);
      }
      
    } catch (error) {
      console.log('❌ Request failed:', error.message);
    }
  }
};

// Instructions for running
console.log('Voice Processing Format Debug Script');
console.log('=====================================');
console.log('1. Open browser dev tools');
console.log('2. Copy this script to console');
console.log('3. Run: testVoiceProcessingFormats()');
console.log('4. Compare dev vs prod response formats');

// Uncomment to run automatically:
// testVoiceProcessingFormats();