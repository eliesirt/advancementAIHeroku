#!/usr/bin/env node

// Debug script to test Heroku affinity matching directly
const https = require('https');

function makeRequest(data) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(data);
    
    const options = {
      hostname: 'advancement-ai-b8abf01faf28.herokuapp.com',
      port: 443,
      path: '/api/voice-recordings/process-direct',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'Cookie': 'connect.sid=s%3AsampleCookie'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed);
        } catch (e) {
          resolve({ error: 'Invalid JSON', raw: data });
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

async function testAffinityMatching() {
  console.log('🧪 Testing Heroku Affinity Matching...\n');
  
  const testCases = [
    {
      name: "Hockey Test",
      transcript: "Hockey scholarship donation"
    },
    {
      name: "Engineering Test", 
      transcript: "Engineering scholarship fund"
    },
    {
      name: "Combined Test",
      transcript: "Hockey and engineering scholarship support"
    }
  ];

  for (const testCase of testCases) {
    try {
      console.log(`🎯 Testing: ${testCase.name}`);
      console.log(`📝 Transcript: "${testCase.transcript}"`);
      
      const response = await makeRequest({
        transcript: testCase.transcript,
        audioData: "test",
        duration: 2
      });

      if (response.error) {
        console.log(`❌ Error: ${response.error}`);
        console.log(`Raw response: ${response.raw?.substring(0, 200)}...`);
      } else {
        const extractedInfo = response.extractedInfo || {};
        const affinityTags = extractedInfo.suggestedAffinityTags || [];
        
        console.log(`✅ Response received`);
        console.log(`🎯 Affinity Tags: ${affinityTags.length} found`);
        console.log(`📋 Tags: ${JSON.stringify(affinityTags.slice(0, 5))}`);
        console.log(`🔍 Interests: Professional=${extractedInfo.professionalInterests?.length || 0}, Personal=${extractedInfo.personalInterests?.length || 0}, Philanthropic=${extractedInfo.philanthropicPriorities?.length || 0}`);
        
        if (affinityTags.length === 0) {
          console.log(`⚠️  ISSUE: No affinity tags returned for "${testCase.transcript}"`);
        }
      }
      
      console.log('─'.repeat(50));
      
    } catch (error) {
      console.log(`❌ Request failed: ${error.message}`);
      console.log('─'.repeat(50));
    }
  }
}

testAffinityMatching().catch(console.error);