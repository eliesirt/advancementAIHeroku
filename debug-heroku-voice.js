#!/usr/bin/env node

// Direct test of Heroku voice processing vs Find Tags comparison

import https from 'https';

async function testHerokuVoiceProcessing() {
  console.log('🧪 Testing Heroku Voice Processing vs Find Tags Button\n');

  // Test 1: Voice Processing Route
  console.log('📝 Test 1: Voice Processing Route');
  const voiceData = {
    transcript: "Ice Hockey scholarship donation",
    audioData: "test",
    duration: 2
  };

  try {
    const voiceResponse = await makeRequest('/api/voice-recordings/process-direct', 'POST', voiceData);
    console.log('✅ Voice Processing Response:');
    console.log('- Affinity Tags Found:', voiceResponse.extractedInfo?.suggestedAffinityTags?.length || 0);
    console.log('- Personal Interests:', voiceResponse.extractedInfo?.personalInterests || []);
    console.log('- Philanthropic Priorities:', voiceResponse.extractedInfo?.philanthropicPriorities || []);
    
    // Test 2: Find Tags Button Route (Working)
    console.log('\n📋 Test 2: Find Tags Button Route (Known Working)');
    const findTagsData = {
      professionalInterests: [],
      personalInterests: voiceResponse.extractedInfo?.personalInterests || ["Ice Hockey"],
      philanthropicPriorities: voiceResponse.extractedInfo?.philanthropicPriorities || ["Scholarship donation"],
      rawTranscript: "Ice Hockey scholarship donation"
    };

    const findTagsResponse = await makeRequest('/api/interactions/identify-affinity-tags', 'POST', findTagsData);
    console.log('✅ Find Tags Response:');
    console.log('- Success:', findTagsResponse.success);
    console.log('- Matched Tags:', findTagsResponse.matchedTags?.length || 0);
    console.log('- Sample Tags:', findTagsResponse.matchedTags?.slice(0, 3)?.map(t => t.name) || []);

    // Analysis
    console.log('\n🔍 Analysis:');
    console.log('- Voice Processing Working:', (voiceResponse.extractedInfo?.suggestedAffinityTags?.length || 0) > 0);
    console.log('- Find Tags Working:', (findTagsResponse.matchedTags?.length || 0) > 0);
    console.log('- Issue Confirmed:', (voiceResponse.extractedInfo?.suggestedAffinityTags?.length || 0) === 0 && (findTagsResponse.matchedTags?.length || 0) > 0);

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

async function makeRequest(path, method, data) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(data);
    
    const options = {
      hostname: 'advancement-ai-b8abf01faf28.herokuapp.com',
      port: 443,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'Cookie': 'connect.sid=s%3AsampleCookie'
      }
    };

    const req = https.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseData);
          resolve(parsed);
        } catch (e) {
          console.error('Failed to parse response:', e.message);
          console.log('Raw response:', responseData.substring(0, 500));
          resolve({ error: 'Invalid JSON', raw: responseData });
        }
      });
    });

    req.on('error', (e) => {
      reject(e);
    });

    req.write(postData);
    req.end();
  });
}

testHerokuVoiceProcessing();