// Quick test script to debug voice processing on Heroku production
// Run this to check what the actual API response looks like

const testVoiceProcessing = async () => {
  const url = 'https://advancement-ai-b8abf01faf28.herokuapp.com/api/voice-recordings/process-direct';
  
  const testData = {
    transcript: "This is a test transcript to check if AI analysis is working",
    audioData: "", // Empty audio data to rely on transcript
    duration: 10
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Add auth headers if needed
      },
      body: JSON.stringify(testData)
    });

    const data = await response.json();
    console.log('Response Status:', response.status);
    console.log('Response Data Structure:', Object.keys(data));
    console.log('Full Response:', JSON.stringify(data, null, 2));

    // Check if AI analysis fields are present
    console.log('\n=== AI Analysis Check ===');
    console.log('Has extractedInfo:', !!data.extractedInfo);
    console.log('Has enhancedComments:', !!data.enhancedComments);
    console.log('Has qualityAssessment:', !!data.qualityAssessment);
    
    if (data.extractedInfo) {
      console.log('ExtractedInfo keys:', Object.keys(data.extractedInfo));
    }

  } catch (error) {
    console.error('Test failed:', error);
  }
};

// Uncomment to run:
// testVoiceProcessing();

console.log('Voice processing debug script created. Add authentication and run to test.');